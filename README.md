# myFlix Movie API

myFlix Movie API is the deployed Express backend for the myFlix portfolio project. It serves the movie catalogue, user accounts, and favourites shared by separate React and Angular clients. The API has completed its migration to a Contabo VPS.

## Architecture

The React and Angular frontends are hosted on Cloudflare Workers. Browser requests reach Caddy on the Contabo VPS over HTTPS; Caddy terminates HTTPS and proxies requests to the Dockerized Express API, which connects to MongoDB Atlas.

```text
React / Angular (Cloudflare Workers)
    → HTTPS → Caddy (Contabo VPS)
    → Express API (Docker) → MongoDB Atlas
```

| Service | Production endpoint |
| --- | --- |
| API | [api.myflix.marksavilledesigns.com](https://api.myflix.marksavilledesigns.com) |
| React | [react.myflix.marksavilledesigns.com](https://react.myflix.marksavilledesigns.com) |
| Angular | [angular.myflix.marksavilledesigns.com](https://angular.myflix.marksavilledesigns.com) |

## Technology

- Node.js: `package.json` declares the supported engine range `>=22.22.2 <25`; the Docker image pins Node.js `24.21.0-bookworm-slim`. The live container version has not been independently verified.
- Express 5, Mongoose 8, MongoDB, Passport local and JWT strategies, and bcrypt 6.
- Helmet, configurable CORS, request-size limits, rate limiting, and centralized error handling.
- Node's built-in test runner, Supertest, and MongoDB Memory Server for isolated API and process integration tests.

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

## Local development

Prerequisites: Node.js within `>=22.22.2 <25`, npm, and a reachable local MongoDB instance or a separate development database. Docker Engine is optional for the [container smoke tests](docs/deployment.md#local-build-and-smoke-test); production Compose operations also require Docker Compose.

1. Copy `.env.example` to `.env`. Configure `CONNECTION_URI` for your development database and `JWT_SECRET` with a unique random value of at least 32 bytes. Keep `TRUST_PROXY_HOPS=0` for direct local access.
2. Install dependencies from the lockfile with `npm ci`.
3. Start the development server with `npm run dev` for nodemon-based restarts, or use `npm start`.
4. With the server running, verify the welcome route:

   ```sh
   curl --fail http://localhost:8080/
   ```

   The expected response is `Welcome to MyFlix!`. Adjust the port if you configured a different `PORT`. This verifies HTTP availability, not a database query.

There is no automatic movie-data seed script. Provide development movie records separately using the schema in `models.js`; an empty database has no movie catalogue. Do not use production data for local tests.

The server connects to MongoDB before opening its HTTP listener. If the database connection fails, it does not start listening. `SIGINT` and `SIGTERM` close the listener and MongoDB connection before exit.

`npm start` and `npm run dev` load a root `.env` when it exists; externally supplied environment variables take precedence. The Docker image starts Node directly, and Compose injects production variables from `.env.production`.

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

Supply rate-limit settings as positive integers. The implementation uses integer parsing rather than strict validation of the entire input string.

## npm scripts and validation

| Script | Command | Purpose |
| --- | --- | --- |
| `start` | `npm start` | Start the API with optional local environment loading. |
| `dev` | `npm run dev` | Start with nodemon restart support. |
| `test` | `npm test` | Run isolated API/process and proxy regression tests. |
| `test:watch` | `npm run test:watch` | Run tests in watch mode. |
| `check` | `npm run check` | Check application-module syntax. |
| `lint` | `npm run lint` | Run ESLint 10 with the flat configuration. |

Tests use an isolated in-memory MongoDB instance. They do not use production data or a production connection string. Additional dependency inspection commands are `npm ls --depth=0`, `npm audit --omit=dev`, and `npm audit`; these are not package scripts.

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

`Genre` and `Director` are embedded movie objects with `Name` fields; they are not ObjectId references. User `FavoriteMovies` entries reference Movie ObjectIds.

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

## Production deployment

The API runs in Docker on Contabo behind Caddy, with MongoDB Atlas remaining external to the VPS deployment. The two-stage image installs production dependencies from the lockfile, keeps its native compilation toolchain in the dependency stage, verifies bcrypt in the runtime image, and runs as the non-root `node` user. Runtime sources and package manifests are copied into the image; local environment files are excluded.

`compose.yaml` loads `.env.production`, fixes `NODE_ENV=production` and `PORT=8080`, and joins the external `msd-proxy` network without publishing host ports. The shared Caddy service is managed separately and proxies to `movie-api:8080`. The documented Caddy-only path requires `TRUST_PROXY_HOPS=1`; the application defaults to direct-access mode unless configured. Compose includes an HTTP healthcheck, bounded logs, a restart policy, and graceful shutdown support.

### Compose deployment variable

| Variable | Default | Purpose |
| --- | --- | --- |
| `MOVIE_API_IMAGE_TAG` | `local` | Selects the `movie-api` image tag for builds and release updates. Supply it to Compose through the shell or its interpolation environment; it is separate from application runtime variables in `.env.production`. |

See the [deployment operations guide](docs/deployment.md) for build and smoke tests, production configuration, release commands, rollback, troubleshooting, and details requiring production verification.

## License

ISC, as declared in `package.json`.
