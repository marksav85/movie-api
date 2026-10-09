# Deployment operations

The myFlix Movie API is deployed on a Contabo VPS behind Caddy with HTTPS, using MongoDB Atlas. This guide preserves local smoke tests and operator procedures for subsequent releases. For the architecture, endpoints, runtime variables, and npm scripts, see the [README](../README.md). Commands below are instructions, not evidence that they have been executed or that live infrastructure has been inspected.

## Local build and smoke test

```sh
npm test
npm run check
npm run lint
docker build --check .
docker build -t movie-api:local .
docker run --rm --entrypoint node movie-api:local -e 'const b = require("bcrypt"); console.log(b.compareSync("test", b.hashSync("test", 4)))'
```

For an HTTP smoke test, use a disposable local MongoDB container on a dedicated local network, never Atlas. Create `/tmp/movie-api.docker.env` with a local connection URI, a throwaway JWT secret of at least 32 bytes, `CORS_ALLOWED_ORIGINS=http://localhost:1234`, and `TRUST_PROXY_HOPS=0`.

Run this before starting the containers. It generates 32 random bytes encoded as hex and creates an owner-only file (`0600`), refusing to overwrite an existing file:

```sh
node <<'NODE'
const { writeFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
writeFileSync('/tmp/movie-api.docker.env', [
  'CONNECTION_URI=mongodb://movie-api-test-db:27017/movie-api-test',
  `JWT_SECRET=${randomBytes(32).toString('hex')}`,
  'CORS_ALLOWED_ORIGINS=http://localhost:1234',
  'TRUST_PROXY_HOPS=0',
  '',
].join('\n'), { mode: 0o600, flag: 'wx' });
NODE
```

```sh
docker network create movie-api-test
docker run -d --name movie-api-test-db --network movie-api-test mongo:8
```

Allow the disposable MongoDB container time to initialize before starting the API:

```sh
docker run -d --name movie-api-test --network movie-api-test --env-file /tmp/movie-api.docker.env -p 127.0.0.1:8080:8080 movie-api:local
# Local connection URI: mongodb://movie-api-test-db:27017/movie-api-test
curl --fail http://127.0.0.1:8080/
docker stop movie-api-test
docker rm movie-api-test
docker rm -f movie-api-test-db
docker network rm movie-api-test
rm /tmp/movie-api.docker.env
```

The expected response is `Welcome to MyFlix!`. If the application is still starting, wait briefly and retry the welcome-route request before cleanup.

## Production configuration and release updates

The existing instructions use `/opt/msd/projects/movie-api` on an Ubuntu VPS. Confirm the live operating system and project directory before using these commands on Contabo. Docker Engine, Compose, and Caddy must already be installed. Both Caddy and this service must join the existing external `msd-proxy` network; Compose does not create it. The service publishes no host ports and Caddy uses Docker DNS upstream `movie-api:8080`.

For a fresh configuration, copy `.env.production.example` to `.env.production` on the VPS; preserve an existing production file during updates, restrict permissions (`chmod 600 .env.production`), and supply real values securely. The template's JWT placeholder is deliberately rejected. Required values are `CONNECTION_URI` for the existing Atlas database, a unique `JWT_SECRET` of at least 32 bytes, explicit `CORS_ALLOWED_ORIGINS`, and `TRUST_PROXY_HOPS=1` for the Caddy-only path. Use the React and Angular origins linked in the [README](../README.md#architecture), and review the request-size/rate-limit settings. Compose fixes `NODE_ENV=production` and `PORT=8080`. Preserve the existing signing secret during updates if existing tokens must remain valid.

Allowlist the VPS's actual outbound public IP in Atlas, including IPv6 if used. Use a least-privilege Atlas database account and retain TLS; do not allow all internet addresses. Verify outbound DNS and Atlas connectivity from the VPS before a release update.

For the documented one-hop proxy topology, configure the Cloudflare record for `api.myflix.marksavilledesigns.com` to **DNS only**, pointing to the VPS. Only publish an AAAA record if IPv6 reachability is verified. Cloudflare-proxied API traffic would require reassessing the trusted proxy chain and Caddy forwarding configuration before enabling it.

The corresponding shared Caddyfile site block is shown below. Verify the existing route before changing it, and preserve other sites:

```caddyfile
api.myflix.marksavilledesigns.com {
    reverse_proxy movie-api:8080
}
```

If changing Caddy routing, validate and reload Caddy using the existing proxy Compose project. That project is managed separately and is not included here. Caddy must overwrite untrusted client-supplied forwarded headers using its normal reverse-proxy behavior. Numeric one-hop trust assumes every incoming connection comes through Caddy: do not expose port 8080, and treat all members of `msd-proxy` as trusted infrastructure. An untrusted container with direct access could supply a forged client IP. Local/direct usage must retain `TRUST_PROXY_HOPS=0`; unrestricted trust is rejected.

Before launching or replacing the production API container, verify outbound DNS and MongoDB Atlas connectivity/readiness from the VPS as described above. The application connects to MongoDB before opening its HTTP listener.

For a release update, an operator can run the following after completing that verification, confirming the project directory, and preserving the previous image:

```sh
cd /opt/msd/projects/movie-api
sudo docker network inspect msd-proxy
sudo docker compose config --quiet
# Use a unique release tag and retain the previous image for rollback.
sudo env MOVIE_API_IMAGE_TAG=release-identifier docker compose build --pull
sudo env MOVIE_API_IMAGE_TAG=release-identifier docker compose up -d --no-build
sudo docker compose ps
sudo docker compose logs --tail=100 movie-api
curl --fail https://api.myflix.marksavilledesigns.com/
```

If the application is still starting, wait briefly and retry the welcome-route request; the expected response is `Welcome to MyFlix!`.

Use the intended `MOVIE_API_IMAGE_TAG` for every subsequent Compose operation that recreates or updates the service, following the same `sudo env MOVIE_API_IMAGE_TAG=...` convention. If the variable is unset or empty, Compose falls back to `local`, potentially selecting a different image from the deployed release.

Avoid printing expanded Compose configuration: it includes environment secrets. The HTTP healthcheck requests the existing public `GET /` inside the container every 30 seconds, with a 4-second request deadline, a 5-second check timeout, three retries, and a 60-second startup allowance. It checks HTTP availability only; it does not query Atlas or create a new endpoint. Health requests count toward the existing API rate limit, so keep that limit above the probe traffic (30 requests per default 15-minute window). An unhealthy status does not itself trigger Docker restart; the restart policy applies to process exits. Logs use Docker's `local` driver, capped at three 10 MB files. `init: true` forwards signals, and shutdown has 45 seconds before forced termination.

## Rollback

Record the prior release image tag, environment settings, DNS state, and Caddy route before a release update. Keep the previous release image available until HTTPS, CORS from both clients, authentication, and Atlas connectivity are verified. To roll back the container, restore compatible environment settings and run `MOVIE_API_IMAGE_TAG=previous-release docker compose up -d --no-build` (with the same sudo/environment convention above). Restore DNS/Caddy routing if routing changed during the release. Do not prune retained images until the rollback window closes. Container replacement can briefly interrupt requests; in-memory rate-limit counters reset on restart. Atlas data is external and is not rolled back with the container; maintain database backups separately.


## Troubleshooting

- **Startup fails:** check that required variable names from the [environment reference](../README.md#environment) are configured, then check DNS and Atlas connectivity. The listener starts only after MongoDB connects. Review logs without sharing credentials or connection strings.
- **HTTPS or upstream errors:** verify API DNS, Caddy certificate status, the shared network, and upstream `movie-api:8080`. Do not publish the API port as a workaround.
- **Browser CORS failures:** compare the requesting frontend origin with `CORS_ALLOWED_ORIGINS`; verify both production clients after updates.
- **Unhealthy container:** inspect service status and recent logs. The probe checks HTTP availability only, so separately verify database-backed requests. Docker does not restart a process merely because its healthcheck fails.
- **Unexpected rate limits:** check the configured limits and trusted proxy path. Rate-limit state is in memory and resets when the process restarts.

## Production verification boundaries

The completed Contabo deployment, Caddy HTTPS, Cloudflare Workers frontends, and MongoDB Atlas database are project-owner supplied facts. The repository confirms the Docker image definition and API Compose configuration. It does not independently confirm the deployed image tag or Node version, VPS OS/directory, shared Caddy configuration or certificate persistence, API DNS proxy mode or IPv6, Atlas access rules/account permissions/backups, or the live CORS configuration. Verify these against production before treating the examples above as an exact inventory.
