---
artifactId: CONTEXT_SUMMARY
packId: "2026-10-09T13:49:21Z"
generatedAt: "2026-10-09T13:49:21Z"
generator: "prompt--artifact--generate-context-summary.md"
---

# Context Summary

## Project Type

CommonJS Node.js Express REST API for separate React and Angular myFlix clients. Express 5 and Mongoose 8 serve movie catalogues, user accounts, and favourites. The deployed architecture documented in README.md is Cloudflare Workers frontends → HTTPS/Caddy on a Contabo VPS → Dockerized API → MongoDB Atlas.

## Routing Model and Page Structure

This is an API, not a frontend page router. app.js composes middleware and mounts routes/auth.js at /login, routes/users.js at /users, and routes/movies.js at /movies. index.js connects to MongoDB before listening on all interfaces and handles graceful SIGINT/SIGTERM shutdown. There is no src/ directory or React component/layout hierarchy in the API.

## Source Scope and Component Architecture

SRC_TREE.json records the established root-level Express runtime scope: 12 JavaScript files and two directories, routes/ and middleware/. The snapshot includes every file in that inventory; tests, historical generated documentation, static assets, and deployment files are not source-snapshot inputs. Models, Passport strategies, validated configuration, route modules, and shared authorization/resource/error middleware form the application architecture.

## Authentication, API Behavior, and Models

Public routes are GET / (welcome text), POST /login, and POST /users. Login validates Username/Password and issues a seven-day HS256 JWT plus a sanitized user. Passport local and JWT strategies authenticate requests; protected requests use Authorization: Bearer tokens.

Movie reads are GET /movies, GET /movies/:Title, GET /movies/genre/:Name, and GET /movies/director/:Name. Genre and director searches return matching movie arrays. Genre and Director are embedded objects; user FavoriteMovies entries reference Movie ObjectIds.

User GET, PUT, and DELETE /users/:Username and favourite POST/DELETE /users/:Username/movies/:MovieID require JWT authentication and self-only authorization. GET /users is unsupported. Passwords are bcrypt-hashed on registration/update and omitted from serialized responses. Favourite additions use $addToSet, and movie IDs/resources are checked before mutation. Unknown resources return 404; different existing users return 403; malformed favourite IDs return 400.

## Key Architectural Patterns

Helmet, configured CORS, body limits, in-memory login/API rate limits, Morgan logging, and centralized safe errors protect requests. Proxy trust accepts only direct mode (0) or one Caddy hop (1). Rate limits return 429, oversized requests 413, malformed JSON 400, and unexpected failures safe 500 responses. Integer settings use integer parsing, not strict whole-string validation.

## Supporting Configuration and Local Workflow

package.json supports Node >=22.22.2 <25; .nvmrc selects major 24. npm ci installs the lockfile. The six scripts are start, dev, test, test:watch, check, and lint. start/dev load an optional root .env with external variables taking precedence; dev uses nodemon. Tests use Node's test runner, Supertest, and MongoDB Memory Server, not production data. There is no automatic movie seed script.

.env.example and .env.production.example provide local and production configuration templates. Runtime variable names are: CONNECTION_URI, JWT_SECRET, TRUST_PROXY_HOPS, PORT, NODE_ENV, CORS_ALLOWED_ORIGINS, JSON_BODY_LIMIT, LOGIN_RATE_LIMIT_WINDOW_MS, LOGIN_RATE_LIMIT_MAX, API_RATE_LIMIT_WINDOW_MS, API_RATE_LIMIT_MAX, GET, POST, POST, GET, GET, GET, GET, GET, PUT, DELETE, POST, DELETE, MOVIE_API_IMAGE_TAG. CONNECTION_URI is required at startup; JWT_SECRET must be unique and at least 32 bytes; explicit CORS origins are required in production. Ignored environment files and template values are not included in this pack.

## Docker and Production Deployment

Dockerfile pins Node 24.21.0-bookworm-slim. Its two-stage build installs production dependencies, keeps the native compilation toolchain outside the runtime stage, verifies bcrypt, and runs as the non-root node user. .dockerignore restricts build inputs to manifests and API runtime sources; environment files, playbook content, and historical documentation are excluded.

compose.yaml injects .env.production, fixes production mode and port 8080, publishes no host ports, and joins the external shared msd-proxy network. The separately managed Caddy proxy uses movie-api:8080; the documented path requires TRUST_PROXY_HOPS=1. MongoDB Atlas remains external. MOVIE_API_IMAGE_TAG is a Compose interpolation variable separate from runtime settings; unset/empty values fall back to local, so service updates must retain the intended release tag.

Compose configures restart: unless-stopped, init signal handling, a 45-second shutdown grace period, bounded local logs, and an HTTP-only welcome-route healthcheck. The probe does not query Atlas, and unhealthy status alone does not trigger restart.

## Documentation and Verification Boundaries

README.md documents architecture, production endpoints, setup, variables, scripts, models, authentication, API behavior, and ISC licensing. docs/deployment.md preserves local smoke tests, Atlas readiness before production launch, welcome-request retries, release-tag persistence, operator commands, rollback, and troubleshooting. out/ is historical JSDoc output and is not the supported API reference.

The repository confirms configuration definitions; the deployment architecture is documented project context, not a live inspection. Deployed image/Node version, VPS OS/path, Caddy configuration/certificate persistence, API DNS proxy mode/IPv6, Atlas permissions/backups, and live CORS settings still require production verification. Shared Caddy infrastructure and playbook are managed separately.
