# movie-api

`movie-api` is the local Node.js backend for the myFlix portfolio project. It serves the movie catalogue, user accounts, and favourites used by the related React and Angular myFlix clients. The clients remain separate projects and are not changed here.

## Technology

- Node.js 24 is the declared target; the supported engine range is Node `>=22.22.2 <25`.
- Express 5, Mongoose 8, MongoDB, Passport local and JWT strategies, and bcrypt 6.
- Helmet, configurable CORS, request-size limits, rate limiting, and centralized error handling.
- Node's built-in test runner, Supertest, and MongoDB Memory Server for isolated API and process integration tests.

Node 22 remains supported while deployment compatibility with Node 24 is verified. Use a currently supported Node version, then install from the lockfile:

```sh
npm ci
```

## Project layout

```text
app.js                 Express composition and middleware
index.js               MongoDB-first bootstrap and graceful shutdown
config.js              Environment validation and application configuration
models.js              Movie and user Mongoose models
passport.js            Local and JWT Passport strategies
routes/                Authentication, user, and movie route modules
middleware/            Authorization, validation, resources, and error handling
tests/                 API contract and process integration tests
```

## Local setup

1. Start a local MongoDB instance, or provide a development connection URI.
2. Copy `.env.example` to `.env` and replace the example JWT secret with a unique random value of at least 32 bytes.
3. Install dependencies with `npm ci`.
4. Start the API with `npm start`, or use `npm run dev` for nodemon-based local restart support.

The server connects to MongoDB before opening its HTTP listener. If the database connection fails, it does not start listening. `SIGINT` and `SIGTERM` close the listener and MongoDB connection before exit.

`npm start` and `npm run dev` load a root `.env` when it exists. In deployments, the same commands work without that file and externally supplied environment variables take precedence.

### Environment

`.env.example` is safe for local development only; do not commit real secrets or production connection strings.

| Variable | Required / default | Purpose |
| --- | --- | --- |
| `CONNECTION_URI` | Required when starting the server | MongoDB connection URI. |
| `JWT_SECRET` | Required; at least 32 bytes | JWT signing and verification secret. The placeholder in `.env.example` is rejected. |
| `TRUST_PROXY_HOPS` | `0`; accepts only `0` or `1` | Trust no forwarded IPs locally, or one Caddy hop in production. |
| `PORT` | `8080` | HTTP listener port. |
| `NODE_ENV` | `development` | Enables production logging when set to `production`; production also requires explicit CORS origins. |
| `CORS_ALLOWED_ORIGINS` | Development defaults: `localhost` and `127.0.0.1` on ports `1234` and `4200` | Comma-separated, explicit browser origins. Wildcards and paths are rejected; it is required in production. |
| `JSON_BODY_LIMIT` | `16kb` | JSON and URL-encoded request limit. It must use `kb` or `mb` units and may not exceed `64kb`. |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | Login rate-limit window in milliseconds. |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Login attempts allowed per client IP per window. |
| `API_RATE_LIMIT_WINDOW_MS` | `900000` | General API rate-limit window in milliseconds. |
| `API_RATE_LIMIT_MAX` | `1000` | General API requests allowed per client IP per window. |

All rate-limit settings must be positive integers.

## Development and validation

```sh
npm start        # start the API
npm run dev      # start with nodemon
npm test         # isolated API/process and proxy regression tests
npm run check    # syntax checks for application modules
npm run lint     # ESLint 10 flat-config linting
npm ls --depth=0 # inspect direct installed dependencies
npm audit --omit=dev
npm audit
```

Tests use an isolated in-memory MongoDB instance. They do not use production data or a production connection string.

## Authentication and authorization

`POST /login` authenticates with `Username` and `Password` and returns a signed JWT plus a sanitized user object. Send protected requests with:

```http
Authorization: Bearer <token>
```

User responses do not include `Password` or password hashes. Passwords are hashed on registration and update. A valid token is required for movie routes and user routes. A user may read, update, delete, or change favourites only for the username represented by that token.

## API reference

All JSON bodies and field names below use the existing PascalCase contract.

### Public routes

| Method | Path | Expectation |
| --- | --- | --- |
| `GET` | `/` | Returns the welcome text. |
| `POST` | `/login` | Body: `Username`, `Password`. Returns a sanitized `user` and JWT `token`; invalid credentials and malformed login bodies return `400`. |
| `POST` | `/users` | Body: `Username` (minimum five alphanumeric characters), `Password`, `Email`; optional `Birthday`. Creates a user and returns `201` with a sanitized user. Validation errors return `422`; an existing username returns `400`. |

### Authenticated movie routes

| Method | Path | Expectation |
| --- | --- | --- |
| `GET` | `/movies` | Returns all movies. |
| `GET` | `/movies/:Title` | Returns one movie, or `404` with `Movie not found`. |
| `GET` | `/movies/genre/:Name` | Returns movies whose embedded `Genre.Name` matches `Name`. |
| `GET` | `/movies/director/:Name` | Returns movies whose embedded `Director.Name` matches `Name`. |

`Genre` and `Director` are embedded movie objects with `Name` fields; they are not ObjectId references.

### Self-only user routes

| Method | Path | Expectation |
| --- | --- | --- |
| `GET` | `/users/:Username` | Returns the requested sanitized user only when `:Username` matches the authenticated user. |
| `PUT` | `/users/:Username` | Self-only. Body requires `Username`, `Password`, and valid `Email`; optional `Birthday` must be ISO-8601. Returns `201` with the sanitized updated user. |
| `DELETE` | `/users/:Username` | Self-only. Returns `200` and a deletion message. |
| `POST` | `/users/:Username/movies/:MovieID` | Self-only. Adds an existing movie ObjectId to favourites and returns the updated sanitized user. Repeating the request is idempotent. |
| `DELETE` | `/users/:Username/movies/:MovieID` | Self-only. Removes an existing movie ObjectId from favourites and returns the updated sanitized user. |

There is intentionally no supported `GET /users` endpoint. Requests for a different user return `403`; an unknown user or movie returns `404`; an invalid favourite `MovieID` returns `400`.

## Request protections and errors

Helmet sets security headers. CORS accepts only configured origins (with local React/Angular development defaults outside production). Login and general API rate limits return `429` when exceeded. Oversized bodies return `413`, malformed JSON returns `400`, and unexpected errors return a safe `500` response without internal details.

## Docker deployment

The production image uses Node `24.21.0-bookworm-slim`, production dependencies from the lockfile, and the non-root `node` user. A separate dependency stage includes a native compilation toolchain; the final stage verifies bcrypt hashing and comparison. Only runtime sources and package manifests enter the image. No local environment files are copied.

### Local build and smoke test

```sh
npm test
npm run check
npm run lint
docker build --check .
docker build -t movie-api:local .
docker run --rm --entrypoint node movie-api:local -e 'const b = require("bcrypt"); console.log(b.compareSync("test", b.hashSync("test", 4)))'
```

For an HTTP smoke test, use a disposable local MongoDB container on a dedicated local network, never Atlas. Create `/tmp/movie-api.docker.env` with a local connection URI, a throwaway JWT secret of at least 32 bytes, `CORS_ALLOWED_ORIGINS=http://localhost:1234`, and `TRUST_PROXY_HOPS=0`.

```sh
docker network create movie-api-test
docker run -d --name movie-api-test-db --network movie-api-test mongo:8
docker run -d --name movie-api-test --network movie-api-test --env-file /tmp/movie-api.docker.env -p 127.0.0.1:8080:8080 movie-api:local
# Local connection URI: mongodb://movie-api-test-db:27017/movie-api-test
curl --fail http://127.0.0.1:8080/
docker stop movie-api-test
docker rm movie-api-test
docker rm -f movie-api-test-db
docker network rm movie-api-test
rm /tmp/movie-api.docker.env
```

The expected response is `Welcome to MyFlix!`. Allow the disposable database time to initialize before starting the API.

### Production setup (operator instructions)

Use `/opt/msd/projects/movie-api` on the Contabo Ubuntu VPS. Docker Engine, Compose, and Caddy must already be installed. Both Caddy and this service must join the existing external `msd-proxy` network; Compose does not create it. The service publishes no host ports and Caddy uses Docker DNS upstream `movie-api:8080`.

Copy `.env.production.example` to `.env.production` on the VPS, restrict permissions (`chmod 600 .env.production`), and supply real values securely. The template's JWT placeholder is deliberately rejected. Required values are `CONNECTION_URI` for the existing Atlas database, a unique `JWT_SECRET` of at least 32 bytes, explicit `CORS_ALLOWED_ORIGINS`, and `TRUST_PROXY_HOPS=1` for the Caddy-only path. The template includes the React and Angular production origins and existing request-size/rate-limit defaults. Compose fixes `NODE_ENV=production` and `PORT=8080`. Preserve the existing signing secret during migration if existing tokens must remain valid.

Allowlist the VPS's actual outbound public IP in Atlas, including IPv6 if used. Use a least-privilege Atlas database account and retain TLS; do not allow all internet addresses. Verify outbound DNS and Atlas connectivity from the VPS before migration.

Set the Cloudflare record for `api.myflix.marksavilledesigns.com` to **DNS only**, pointing to the VPS. Only publish an AAAA record if IPv6 reachability is verified. Cloudflare-proxied API traffic would require reassessing the trusted proxy chain and Caddy forwarding configuration before enabling it.

Add this site block to the shared Caddyfile, preserving existing routes:

```caddyfile
api.myflix.marksavilledesigns.com {
    reverse_proxy movie-api:8080
}
```

Validate and reload Caddy using the existing proxy Compose project. Caddy must overwrite untrusted client-supplied forwarded headers using its normal reverse-proxy behavior. Numeric one-hop trust assumes every incoming connection comes through Caddy: do not expose port 8080, and treat all members of `msd-proxy` as trusted infrastructure. An untrusted container with direct access could supply a forged client IP. Local/direct usage must retain `TRUST_PROXY_HOPS=0`; unrestricted trust is rejected.

When authorized to deploy, an operator can run:

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

Avoid printing expanded Compose configuration: it includes environment secrets. The HTTP healthcheck requests the existing public `GET /` inside the container every 30 seconds, with a 4-second request deadline, a 5-second check timeout, three retries, and a 60-second startup allowance. It checks HTTP availability only; it does not query Atlas or create a new endpoint. Health requests count toward the existing API rate limit, so keep that limit above the probe traffic (30 requests per default 15-minute window). An unhealthy status does not itself trigger Docker restart; the restart policy applies to process exits. Logs use Docker's `local` driver, capped at three 10 MB files. `init: true` forwards signals, and shutdown has 45 seconds before forced termination.

### Rollback and cutover

Record the prior release image tag, environment settings, DNS state, and Caddy route before cutover. Keep the previous deployment available until HTTPS, CORS from both clients, authentication, and Atlas connectivity are verified. To roll back the container, restore compatible environment settings and run `MOVIE_API_IMAGE_TAG=previous-release docker compose up -d --no-build` (with the same sudo/environment convention above). Restore DNS/Caddy routing if the cutover requires it. Do not prune retained images until the rollback window closes. Container replacement can briefly interrupt requests; in-memory rate-limit counters reset on restart. Atlas data is external and is not rolled back with the container; maintain database backups separately.

Deployment support is prepared in this repository. No VPS deployment, production connection, DNS change, or Caddy reload is performed by this change.
