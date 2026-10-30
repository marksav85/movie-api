# Movie API — Operations Runbook

## Service overview

The Movie API serves the myFlix React and Angular clients. The documented production architecture places the Express service in Docker on a Contabo VPS behind Caddy with HTTPS; MongoDB Atlas remains external. The repository configures the API container and Compose network attachment. Caddy, DNS, Cloudflare, the VPS, and Atlas are separately managed systems.

The public API URL documented by the project is `https://api.myflix.marksavilledesigns.com/`. Details below distinguish repository configuration from owner-reported or unverified state. Confirm the live host, paths, tags, network settings, DNS values, and commands with an authorized operator before relying on them.

## Dependencies and ownership

| Component | Role | Evidence and boundary |
| --- | --- | --- |
| Movie API | Express application in the `movie-api` Docker service | Image and Compose settings are repository-configured. |
| Caddy | HTTPS termination and proxy to `movie-api:8080` | Shared proxy project is managed separately; its live configuration is not in this repository. |
| MongoDB Atlas | Persistent application data | External dependency; connectivity and permissions require operator confirmation. |
| React and Angular clients | Browser clients | Separate projects; this repository documents their public URLs and allowed origins. |
| Cloudflare Workers | Frontend hosting in the documented topology | Dashboard settings and live bindings are outside this repository. |

The repository does not identify accountable operators, account names, backup schedule, alerting channel, or escalation process. Confirm these through approved private records; do not add credentials or personal account details here.

## Configuration and secrets

Application variables are supplied through `.env` for local npm commands or `.env.production` for Compose. The Docker image starts Node directly and does not copy local environment files. Compose sets `NODE_ENV=production` and `PORT=8080`, loads `.env.production`, and uses the separate Compose interpolation variable `MOVIE_API_IMAGE_TAG` (default `local`).

| Variable | Purpose / constraint |
| --- | --- |
| `CONNECTION_URI` | MongoDB URI; required before startup. Production uses the authorized Atlas URI. |
| `JWT_SECRET` | Unique signing secret of at least 32 bytes. Preserve its current production value during releases if existing tokens must remain valid. |
| `CORS_ALLOWED_ORIGINS` | Explicit comma-separated origins; required in production. |
| `TRUST_PROXY_HOPS` | `0` for direct/local access; `1` only for the documented Caddy-only path. |
| `NODE_ENV` | Production mode is fixed by Compose. |
| `PORT` | Listener port; Compose sets `8080`. |
| `JSON_BODY_LIMIT` | Request body limit; default `16kb`, maximum accepted `64kb`. |
| `LOGIN_RATE_LIMIT_WINDOW_MS`, `LOGIN_RATE_LIMIT_MAX` | Login limiter window and maximum. |
| `API_RATE_LIMIT_WINDOW_MS`, `API_RATE_LIMIT_MAX` | General API limiter window and maximum. |
| `MOVIE_API_IMAGE_TAG` | Compose image selection only; pass consistently to commands that use the deployed release. Empty/unset values select `local`. |

Use `.env.example` only as a local template and `.env.production.example` only as a placeholder reference. Do not commit real environment files, print expanded Compose configuration, paste secret values into tickets or logs, or store credentials here. Restrict production environment-file permissions (`chmod 600 .env.production` is documented), and supply values through the owner-approved secure channel.

## Local development and container smoke test

For npm development, use a Node version in the package engine range and a separate local/development database. `npm start` and `npm run dev` load `.env` when present; external environment variables take precedence. `npm test` uses MongoDB Memory Server and must not use Atlas or production data.

The repository documents these local checks:

```sh
npm test
npm run check
npm run lint
docker build --check .
docker build -t movie-api:local .
docker run --rm --entrypoint node movie-api:local -e 'const b = require("bcrypt"); console.log(b.compareSync("test", b.hashSync("test", 4)))'
```

For an isolated Docker HTTP smoke test, the documented procedure creates `/tmp/movie-api.docker.env` with a local MongoDB URI and throwaway JWT secret, then uses a dedicated `movie-api-test` Docker network and disposable MongoDB container. These commands create and remove local containers, a local network, and a temporary file. Run them only on a local machine with Docker, use no production values, and confirm the resource names belong to this test before cleanup.

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

docker network create movie-api-test
docker run -d --name movie-api-test-db --network movie-api-test mongo:8
```

After MongoDB is ready, start and check the API, then clean up the disposable resources:

```sh
docker run -d --name movie-api-test --network movie-api-test \
  --env-file /tmp/movie-api.docker.env -p 127.0.0.1:8080:8080 movie-api:local
curl --fail http://127.0.0.1:8080/
docker stop movie-api-test
docker rm movie-api-test
docker rm -f movie-api-test-db
docker network rm movie-api-test
rm /tmp/movie-api.docker.env
```

The expected response is `Welcome to MyFlix!`. If startup is still in progress, wait and retry. Do not reuse these container, network, or file names for unrelated services.

## Production architecture and preflight

Production Compose joins the pre-existing external `msd-proxy` network, publishes no host port, and addresses the API at `movie-api:8080`. The application connects to MongoDB before opening its HTTP listener. This runbook contains the deployment and operational guidance, including the documented `/opt/msd/projects/movie-api` path on an Ubuntu VPS; confirm the live operating system and project path before using commands.

Before an authorized release:

1. Confirm target host, repository directory, current release tag, and operator authorization.
2. Confirm Docker Engine, Compose, the external `msd-proxy` network, and shared Caddy service availability.
3. Confirm `.env.production` exists with correct current values and secure permissions. Preserve existing values, especially `JWT_SECRET`, unless a separately approved rotation is planned.
4. Confirm outbound DNS and Atlas connectivity from the VPS. Use a least-privilege Atlas account, retain TLS, and allowlist the VPS's actual outbound IP. Include IPv6 only if it is used and verified; do not allow unrestricted internet access.
5. Confirm `CORS_ALLOWED_ORIGINS` matches approved frontend origins and `TRUST_PROXY_HOPS=1` is appropriate for Caddy-only ingress.
6. Confirm the prior release image and compatible configuration are available for rollback.

The documented topology expects the API's Cloudflare DNS record to be DNS only and points it to the VPS; publish an AAAA record only if IPv6 reachability is verified. Enabling Cloudflare proxying requires reassessing the trusted proxy chain and Caddy forwarding behavior. Verify actual DNS mode before relying on this topology.

The one-hop trust setting assumes every inbound connection reaches the API through Caddy. Do not expose port 8080 publicly. Caddy must overwrite untrusted client-supplied forwarded headers, and every member of `msd-proxy` is part of the trusted infrastructure boundary; an untrusted container on that network could forge client IP information. Keep `TRUST_PROXY_HOPS=0` for direct/local use.

## Release procedure

These are documented operator commands, not evidence of a completed deployment. Run only with explicit deployment authorization after verifying the live target and preflight above. Do not print expanded Compose configuration; it can reveal environment values.

```sh
cd /opt/msd/projects/movie-api
sudo docker network inspect msd-proxy
sudo docker compose config --quiet

# Replace release-identifier with a unique release tag and retain the prior image.
sudo env MOVIE_API_IMAGE_TAG=release-identifier docker compose build --pull
sudo env MOVIE_API_IMAGE_TAG=release-identifier docker compose up -d --no-build
sudo env MOVIE_API_IMAGE_TAG=release-identifier docker compose ps
sudo env MOVIE_API_IMAGE_TAG=release-identifier docker compose logs --tail=100 movie-api
curl --fail https://api.myflix.marksavilledesigns.com/
```

Use the same `MOVIE_API_IMAGE_TAG` on Compose commands that inspect, recreate, update, or roll back the selected release; otherwise Compose may select `local`. Review logs without sharing credentials or connection strings. If startup is still in progress, retry the welcome request after a short wait.

If an approved release includes a Caddy route change, inspect existing shared configuration first, preserve other sites, validate it, and reload through its separately managed Compose project. The documented site block is:

```caddyfile
api.myflix.marksavilledesigns.com {
    reverse_proxy movie-api:8080
}
```

Do not change Caddy or shared infrastructure as part of an API-only task without explicit authorization.

## Health, verification, and monitoring

Compose configures an HTTP healthcheck against `GET /` at `127.0.0.1:8080`, every 30 seconds, with a four-second request deadline, five-second check timeout, three retries, and 60-second startup allowance. It checks HTTP availability only; it does not query Atlas. An unhealthy status alone does not restart the process; the restart policy applies when the process exits. Health requests count toward the general API rate limit (about 30 per default 15-minute window), so keep that limit above probe traffic; the default permits 1000 requests per 15 minutes.

After an authorized release, verify the public welcome route, a representative authenticated API action, both frontend origins where available, and critical database-backed behavior through an approved test account. The owner has reported prior checks of `GET /` returning HTTP 200, unauthenticated `GET /movies` returning HTTP 401, and a frontend flow covering registration, login, saving movies, logout, a subsequent login, and account deletion. These reports do not establish current deployment configuration, Atlas backup/recovery capability, or every journey.

Compose uses the `local` logging driver capped at three 10 MB files, `init: true`, a 45-second shutdown grace period, and `restart: unless-stopped`. No external monitoring or alerting integration is configured in this repository. Review container status and recent logs when investigating incidents; do not expose secrets in shared output.

## Rollback and data recovery

Before replacement, record the prior image tag and confirm compatible environment settings and routing state are available. After an authorized rollback decision:

```sh
cd /opt/msd/projects/movie-api
sudo env MOVIE_API_IMAGE_TAG=previous-release docker compose up -d --no-build
sudo env MOVIE_API_IMAGE_TAG=previous-release docker compose ps
sudo env MOVIE_API_IMAGE_TAG=previous-release docker compose logs --tail=100 movie-api
curl --fail https://api.myflix.marksavilledesigns.com/
```

Restore DNS or Caddy routing only if it changed and the separate infrastructure task is authorized. Keep the previous image until verification and the agreed rollback window are complete. Container rollback does not roll back Atlas data. The repository establishes no backup schedule or tested database restoration procedure; confirm Atlas recovery arrangements with the authorized owner before treating data recovery as available.

## Troubleshooting

| Symptom | Checks and safe response |
| --- | --- |
| Service does not start | Confirm required variable names are supplied, then inspect container logs. The listener starts only after MongoDB connects; verify VPS DNS and Atlas reachability before replacing the container. Do not display secrets. |
| HTTPS or upstream errors | Confirm API DNS, Caddy certificate/routing state, `msd-proxy` membership, and upstream `movie-api:8080` with the relevant operator. Do not publish port 8080 as a workaround. |
| Browser CORS failures | Compare the requesting origin with `CORS_ALLOWED_ORIGINS`, then verify approved React and Angular origins after a release. |
| Container marked unhealthy | Inspect service status and logs, then check the welcome route. The healthcheck does not test Atlas; use an authorized database-backed check separately. An unhealthy status does not itself restart the process. |
| Unexpected rate limits | Review configured limits and trusted proxy path. Rate-limit state is in memory and resets when the process restarts. |
| Atlas connection failures | Check outbound DNS, Atlas allowlist, account privileges, TLS, and the configured connection URI through secure operator tooling. Never paste the URI into logs or chat. |

## Operational facts requiring confirmation

Repository files establish the image definition, Compose service settings, documented host path/topology, Caddy upstream pattern, and environment-variable names. They do not confirm the deployed image or Node version, live VPS OS/path, Caddy configuration or certificate persistence, DNS proxy mode or IPv6, Atlas privileges/backups, secret-store state, monitoring, or tested rollback/restoration. Treat those as owner/operator-confirmed items, not repository-verified facts.
