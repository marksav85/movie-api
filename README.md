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
npm test         # 23 isolated API/process integration tests
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

## Deployment status

This repository documents and validates the finished local backend refactor. Production deployment migration is separate work: no Contabo VPS, Docker, Caddy, Atlas, Render, or production URL changes are claimed here.
