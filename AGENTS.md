# Movie API — Project Instructions

## Repository boundaries

Make project changes within this Movie API repository. Treat other repositories as separate protected workspaces; do not modify them from this repository.

## Project context

This repository contains the Node.js REST API for the myFlix React and Angular clients. It uses CommonJS, Express 5, Mongoose 8, and MongoDB. The API provides movie catalogue, account, authentication, and favourite-movie operations.

## Repository structure

- `app.js` configures Express middleware and mounts the API routes.
- `index.js` connects to MongoDB before listening and closes the HTTP server and database connection on `SIGINT` or `SIGTERM`.
- `config.js` validates environment settings; `models.js` defines Movie and User schemas; `passport.js` configures local and JWT authentication.
- `routes/` contains authentication, movie, and user endpoints.
- `middleware/` contains authorization, request validation, resource lookup, and error handling.
- `tests/` contains API characterization and proxy-configuration tests. The API tests use MongoDB Memory Server.
- `Dockerfile`, `compose.yaml`, and `docs/operations-runbook.md` describe the container and deployment operations.

Follow the existing root-level Express structure; there is no `src/` directory.

## Development and verification

Use a Node.js version in the `package.json` engine range (`>=22.22.2 <25`); `.nvmrc` selects Node 24. Install locked dependencies with `npm ci` when installation is authorized.

- `npm start` starts the API.
- `npm run dev` starts it with Nodemon.
- `npm test` runs the API and proxy tests.
- `npm run lint` runs ESLint.
- `npm run check` runs the configured Node syntax checks.
- Prettier formats the maintained JavaScript files listed in the `format` and `format:check` scripts, using `.prettierrc.json`; dependencies and generated historical artifacts are excluded in `.prettierignore`.
- Run `npm run format` for an explicitly approved formatting pass and `npm run format:check` to verify formatting. Format relevant new or modified JavaScript files during focused work; do not run repository-wide formatting without owner approval. Formatting and linting are separate checks.

Run relevant existing checks for changes and report the commands and results. Do not describe checks that were not run as passing. Do not add test frameworks or dependencies without approval.

## API, authentication, and data preservation

- Preserve the existing PascalCase API fields, route paths, status codes, and response shapes used by both frontend clients unless an API change is explicitly approved.
- Preserve JWT bearer authentication and self-only access for user profile, deletion, and favourite operations. Movie and user routes require authentication as implemented.
- Keep password hashing in place and never expose password hashes in responses, logs, documentation, or reports.
- Treat MongoDB data as persistent user data. Tests must use their isolated in-memory database; never point tests at production. Do not perform destructive database operations or alter stored-data formats without explicit approval.

## Environment, secrets, and deployment

- Use `.env.example` for local configuration and `.env.production.example` as a placeholder reference. Keep real environment files and secret values out of Git and do not print them in command output or reports.
- `CONNECTION_URI` selects the MongoDB connection; `JWT_SECRET` must be unique and at least 32 bytes. Production requires explicit `CORS_ALLOWED_ORIGINS`. `TRUST_PROXY_HOPS` is restricted to `0` for direct access or `1` for the documented Caddy-only path. Other supported settings are documented in `README.md` and `config.js`.
- Local development must use a separate development database. Do not use production credentials or data for local work or tests.
- Production runs as a Docker service behind separately managed Caddy infrastructure and uses MongoDB Atlas. Do not access or change production databases, deployment infrastructure, DNS, secrets, or services without explicit authorization. Do not deploy as part of ordinary code changes.

## Working conventions and approvals

- Make the smallest focused change that satisfies the authorized task; preserve established architecture and unrelated work.
- Inspect relevant source and configuration before changing behavior. Update directly affected documentation where appropriate.
- Do not install or update dependencies, commit, push, or deploy without explicit authorization.
- Report files changed, verification performed, results, and material uncertainties.
