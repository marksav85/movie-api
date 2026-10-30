# myFlix Movie API — Shared Backend for React and Angular Clients

The myFlix Movie API is a Node.js and Express backend for the project’s React and Angular clients. It provides movie catalogue access, user registration and profile management, authentication, and favourite movies, backed by MongoDB.

**[Explore the live API](https://api.myflix.marksavilledesigns.com/)**

Frontend clients: [React](https://react.myflix.marksavilledesigns.com/) · [Angular](https://angular.myflix.marksavilledesigns.com/)

## Features

- Register accounts, authenticate, and manage a user profile.
- Browse movies and search by title, genre, or director.
- Save and remove favourite movies from an authenticated account.
- Validate requests and restrict user-specific actions to the signed-in user.

## Technology

| Area | Technologies |
| --- | --- |
| Runtime and API | Node.js, Express 5, CommonJS |
| Data | MongoDB and Mongoose 8 |
| Authentication | Passport local and JWT strategies, bcrypt |
| Request protections | Helmet, configured CORS, body-size limits, rate limiting |
| Verification | Node.js test runner, Supertest, MongoDB Memory Server, ESLint |
| Deployment configuration | Docker and Docker Compose; documented Caddy reverse proxy |

## How it works

The React and Angular frontends are hosted on Cloudflare Workers. In the documented production topology, browser requests use HTTPS through Caddy on a Contabo VPS, which proxies to the Dockerized Express API. The API connects to MongoDB Atlas. Caddy and the database are managed separately from this repository.

`app.js` configures middleware and routes; `index.js` connects to MongoDB before listening and closes the connection during graceful shutdown. Mongoose models represent movies and users. User favourites contain movie ObjectIds; genre and director details are embedded in movie documents.

## Getting started

Prerequisites: Node.js `>=22.22.2 <25`, npm, and a separate local MongoDB database. Docker is optional for the container smoke test documented in the [Operations Runbook](docs/operations-runbook.md).

1. Copy `.env.example` to `.env` and set `CONNECTION_URI` to a development database and `JWT_SECRET` to a unique random value of at least 32 bytes. Keep `TRUST_PROXY_HOPS=0` for direct local access.
2. Install locked dependencies with `npm ci`.
3. Run `npm run dev` for Nodemon restarts or `npm start` to start the API.
4. Check the welcome route at `http://localhost:8080/` (or your configured port).

An empty database has no movie catalogue; the repository does not include a seed script. Do not use production data for local development or tests. The server connects to MongoDB before it opens its HTTP listener.

### Configuration

`npm start` and `npm run dev` load `.env` when present; externally supplied environment values take precedence. `.env.example` is a local template, not a place for committed secrets. Production configuration is supplied through `.env.production` by Compose. See `.env.production.example` for placeholder names only.

| Variable | Required / default | Purpose |
| --- | --- | --- |
| `CONNECTION_URI` | Required at startup | MongoDB connection URI. |
| `JWT_SECRET` | Required; at least 32 bytes | JWT signing and verification secret; example placeholder is rejected. |
| `TRUST_PROXY_HOPS` | `0` | `0` for direct access or `1` for the documented Caddy-only path. |
| `PORT` | `8080` | HTTP listener port. |
| `NODE_ENV` | `development` | Production requires explicit CORS origins. |
| `CORS_ALLOWED_ORIGINS` | Local defaults for ports 1234 and 4200 | Explicit comma-separated browser origins; required in production. |
| `JSON_BODY_LIMIT` | `16kb` | Body limit using `kb` or `mb` units; maximum accepted is `64kb`. |
| `LOGIN_RATE_LIMIT_WINDOW_MS` | `900000` | Login rate-limit window in milliseconds. |
| `LOGIN_RATE_LIMIT_MAX` | `10` | Login attempts per client IP per window. |
| `API_RATE_LIMIT_WINDOW_MS` | `900000` | General API rate-limit window in milliseconds. |
| `API_RATE_LIMIT_MAX` | `1000` | General API requests per client IP per window. |

Keep connection strings, signing secrets, and real environment files private. Never expose secret values in documentation, logs, or support output.

### Testing

```sh
npm test
npm run lint
npm run check
```

Tests use MongoDB Memory Server and do not require production data or a production connection string.

## Authentication and security

`POST /login` accepts `Username` and `Password`, returns a sanitized user and a signed JWT. Send protected requests with `Authorization: Bearer <token>`. Passwords are hashed with bcrypt and omitted from user JSON responses. User profile, deletion, and favourite operations are restricted to the authenticated user. Helmet, explicit CORS configuration, request limits, and in-memory rate limits are applied by the API.

## API reference

JSON request fields use the existing PascalCase contract.

### Public routes

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/` | Returns the welcome text. |
| `POST` | `/login` | Authenticates `Username` and `Password`; returns user and JWT. Invalid credentials or malformed login return `400`. |
| `POST` | `/users` | Registers `Username`, `Password`, `Email`, and optional `Birthday`; returns `201`. Validation errors return `422`; a duplicate username returns `400`. |

### Authenticated movie routes

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/movies` | Returns all movies. |
| `GET` | `/movies/:Title` | Returns one movie or `404`. |
| `GET` | `/movies/genre/:Name` | Returns movies matching embedded `Genre.Name`. |
| `GET` | `/movies/director/:Name` | Returns movies matching embedded `Director.Name`. |

### Self-only user routes

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/users/:Username` | Returns the authenticated user’s sanitized profile. |
| `PUT` | `/users/:Username` | Updates the authenticated user’s profile; returns `201`. |
| `DELETE` | `/users/:Username` | Deletes the authenticated user’s account. |
| `POST` | `/users/:Username/movies/:MovieID` | Adds an existing movie to favourites; repeated additions are idempotent. |
| `DELETE` | `/users/:Username/movies/:MovieID` | Removes a movie from favourites. |

There is no supported `GET /users` collection route. Requests for another user return `403`; missing users or movies return `404`; malformed favourite IDs return `400`.

## Deployment

The repository defines a two-stage Docker image that installs production dependencies from the lockfile, verifies the bcrypt native module, and runs as the non-root Node user. Compose joins the external `msd-proxy` network without publishing a host port and loads `.env.production`. The API healthcheck verifies HTTP availability at `/`; it does not query MongoDB.

For local container smoke tests, production release and rollback procedures, troubleshooting, and operational boundaries, see the [Operations Runbook](docs/operations-runbook.md). Implementation details and maintenance constraints are in the [Development Handbook](docs/development-handbook.md).

## License

ISC, as declared in `package.json`.
