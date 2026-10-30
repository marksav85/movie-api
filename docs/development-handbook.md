# Movie API — Development Handbook

## Project context

The Movie API is the shared Node.js backend for the myFlix React and Angular clients. It provides movie catalogue reads, account registration and self-service profile operations, authentication, and saved favourites. The implementation is a small CommonJS application using Express 5, Mongoose 8, and MongoDB.

The API retains the established PascalCase request and response fields used by both clients. There is no frontend or `src/` directory in this repository.

## Architecture and data flow

`index.js` is the process entry point. It requires `CONNECTION_URI`, connects to MongoDB before opening the HTTP listener, and closes the listener and Mongoose connection on `SIGINT` or `SIGTERM`. `app.js` builds the Express application, installs security, logging, rate-limit, body parsing, CORS, and error middleware, then mounts the route modules. Importing the app for tests does not start the listener.

```text
React / Angular clients
        │ HTTPS through Caddy
        ▼
Express application (app.js)
  ├── /login   routes/auth.js
  ├── /users   routes/users.js
  └── /movies  routes/movies.js
        │ Mongoose
        ▼
     MongoDB
```

The production topology documented by the project uses a Dockerized API behind separately managed Caddy on a Contabo VPS, with MongoDB Atlas as the database. See the [Operations Runbook](operations-runbook.md) for operating procedures and the limits of what has been independently verified.

## Source responsibilities

- `app.js` composes Express middleware and route modules.
- `index.js` owns database-first startup and graceful shutdown.
- `config.js` validates environment values and exports parsed settings.
- `models.js` defines the Movie and User Mongoose models and user password helpers.
- `passport.js` configures Passport local authentication and bearer JWT authentication.
- `routes/auth.js`, `routes/movies.js`, and `routes/users.js` implement the public and authenticated API operations.
- `middleware/authorization.js` enforces self-only user access. `middleware/resources.js` loads users and validates favourite movie IDs. `middleware/validation.js` formats request validation errors. `middleware/errors.js` returns controlled client errors and safe generic server errors.
- `tests/api.characterization.test.js` covers API behavior and process startup using MongoDB Memory Server. `tests/proxy.test.js` checks proxy trust and login rate limiting in child processes.

The route inventory, field names, status codes, and response expectations are maintained in the [README API reference](../README.md#api-reference).

## Data model and persistence

`Movie` stores title, description, embedded `Genre` and `Director` objects, image path, and featured status. `Genre` and `Director` are embedded objects with `Name` fields, not separate ObjectId references.

`User` stores username, password hash, email, optional birthday, and `FavoriteMovies`, which contains Movie ObjectIds. User JSON serialization omits `Password`. Passwords are hashed with bcrypt by the model helper and verified through the model password-validation method.

The application does not include an automatic movie catalogue seed. A newly connected empty database will not contain movies. Production data is persistent and external to the container; local tests use an isolated in-memory MongoDB instance and must never target production.

## Authentication, authorization, and API behavior

`POST /users` registers validated user details. `POST /login` authenticates the supplied `Username` and `Password` with Passport local strategy, then issues an HS256 JWT with a seven-day expiry and the username as its subject. Protected requests use `Authorization: Bearer <token>`; the JWT strategy reloads the user from MongoDB.

Movie routes require JWT authentication. User profile, deletion, and favourite routes require the authenticated username to match the requested username. Favourites are added idempotently with `$addToSet` and removed with `$pull`, after validating that the target movie exists. Do not weaken these access checks or change field names, route semantics, or response shapes without explicit approval and coordination with both clients.

Request validation is implemented with `express-validator`. Registration validates username, password, email, and optional calendar birthday. Profile updates preserve an existing password when it is omitted or blank according to the current route behavior, and validate any replacement. Middleware limits parsed request bodies and maps validation, malformed JSON, oversized body, CORS rejection, and unexpected failures to controlled responses.

## Security and configuration

`config.js` requires `JWT_SECRET` to be unique and at least 32 bytes. Production requires explicit comma-separated `CORS_ALLOWED_ORIGINS`; wildcard origins and origin paths are rejected. `TRUST_PROXY_HOPS` accepts only `0` for direct access and `1` for the documented Caddy-only path. The application uses Helmet, login and general in-memory rate limits, and Morgan logging. Do not log credentials or return internal exception details to clients.

Local configuration is loaded from `.env` by the `start` and `dev` npm scripts, while externally supplied environment variables take precedence. Docker starts Node directly and Compose loads `.env.production`. Keep real environment files, connection strings, signing secrets, and other credentials out of Git and out of documentation. Refer to `.env.example`, `.env.production.example`, and `config.js` for variable names and validation; never copy values from a local environment file into reports.

## Development and verification

The package declares Node.js `>=22.22.2 <25`; `.nvmrc` selects major version 24. Install dependencies from the lockfile with `npm ci` when installation is authorized.

| Command | Purpose |
| --- | --- |
| `npm start` | Start the API with optional `.env` loading. |
| `npm run dev` | Start with Nodemon. |
| `npm test` | Run API characterization and proxy tests. |
| `npm run lint` | Run ESLint using `eslint.config.cjs`. |
| `npm run check` | Run the configured Node syntax checks. |
| `npm run format` | Format the maintained JavaScript files. |
| `npm run format:check` | Verify formatting without modifying files. |

The API tests create MongoDB Memory Server and use its generated URI. Child-process tests use isolated configuration and test connections. Do not substitute production connection details. At the current finalization review, the owner reported that 32 automated tests passed and ESLint and syntax checks passed; this is reported verification evidence, not a claim that every runtime or production condition has been independently tested.

## Maintenance guidance

- Preserve the existing root-level Express structure and use existing middleware and model helpers where they fit.
- Treat the README API reference and both client integrations as compatibility contracts. Discuss any breaking route, field, status, or serialization change before implementation.
- Preserve self-only access checks, password hashing and omission, request validation, and database ownership boundaries.
- Use isolated local databases and tests. Do not run destructive data operations or production checks without explicit authorization.
- Keep changes focused. Reuse the existing test, lint, and syntax-check commands; add dependencies or new infrastructure only when a specific approved need exists.
- Follow the root `AGENTS.md` and global Codex workspace safety instructions.

## Decisions, issues, and limitations

Current source and tests establish the implementation described above. The available project record supplied for this handbook does not include a complete historical decision log or incident record, so no additional rationale or past failure is inferred. The owner has reported successful live checks for `GET /`, unauthenticated `GET /movies` returning HTTP 401, and a frontend flow covering registration, login, saving movies, logout, a subsequent login, and account deletion. Treat those as owner-reported production acceptance evidence.

The repository does not independently establish the live container image and runtime version, VPS configuration, Caddy state, DNS mode, Atlas permissions and backups, secret-store state, or rollback readiness. These operational facts belong in the runbook and require authorized operator confirmation where material.
