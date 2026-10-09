---
artifactId: CONTEXT_SUMMARY
packId: "2026-10-09T14:39:36Z"
generatedAt: "2026-10-09T14:39:36Z"
generator: "prompt--artifact--generate-context-summary.md"
---

# Context Summary

## Project Type

CommonJS Node.js Express REST API for separate React and Angular myFlix clients, serving movie catalogues, user accounts, and favourites through Express 5 and Mongoose 8. README.md documents Cloudflare Workers frontends → HTTPS/Caddy on a Contabo VPS → Dockerized API → MongoDB Atlas.

## Routing Model and Page Structure

This API has no frontend pages, React components, or layout hierarchy. app.js composes middleware and mounts routes/auth.js at /login, routes/users.js at /users, and routes/movies.js at /movies. index.js connects to MongoDB before listening and handles graceful SIGINT/SIGTERM shutdown.

## Source Scope and Component Architecture

SRC_TREE.json records the established root-level Express scope: 12 runtime JavaScript files and 2 directories, routes/ and middleware/. The snapshot covers every inventoried source file; tests and deployment files are excluded. Models, Passport strategies, configuration, route modules, and shared authorization/resource/error middleware form the application architecture. There is no src/ directory.

## Authentication, API Behavior, and Models

Public routes are GET / (welcome text), POST /login, and POST /users. Passport local authentication checks Username/Password; login issues a seven-day HS256 JWT and sanitized user. Protected requests use Authorization: Bearer tokens and Passport JWT authentication.

Movie reads are GET /movies, GET /movies/:Title, GET /movies/genre/:Name, and GET /movies/director/:Name. Genre/director searches return matching movie arrays. Genre and Director are embedded objects; user FavoriteMovies entries reference Movie ObjectIds.

User GET, PUT, and DELETE /users/:Username and favourite POST/DELETE /users/:Username/movies/:MovieID require JWT authentication and self-only authorization. GET /users is unsupported. Passwords are bcrypt-hashed on registration/update and omitted from serialization. Favourite additions use $addToSet; movie IDs and resources are validated. Unknown resources return 404, different existing users 403, and malformed favourite IDs 400.

## Key Architectural Patterns

Helmet, configurable CORS, request-body limits, in-memory login/API rate limits, Morgan logging, and centralized errors protect requests. Proxy trust accepts only direct mode (0) or one Caddy hop (1). Rate limits return 429, oversized requests 413, malformed JSON 400, and unexpected failures safe 500 responses. Rate-limit settings use integer parsing rather than strict whole-string validation.

## Supporting Configuration and Local Workflow

package.json supports Node >=22.22.2 <25; .nvmrc selects major 24. npm ci installs from the lockfile. The six scripts are start, dev, test, test:watch, check, and lint. start/dev load an optional root .env with external variables taking precedence; dev uses nodemon. Tests use Node's test runner, Supertest, and MongoDB Memory Server rather than production data. No automatic movie-data seed script exists.

.env.example and .env.production.example provide local/production templates. Application runtime variable names are: API_RATE_LIMIT_MAX, API_RATE_LIMIT_WINDOW_MS, CONNECTION_URI, CORS_ALLOWED_ORIGINS, JSON_BODY_LIMIT, JWT_SECRET, LOGIN_RATE_LIMIT_MAX, LOGIN_RATE_LIMIT_WINDOW_MS, NODE_ENV, PORT, TRUST_PROXY_HOPS. CONNECTION_URI is required at startup; JWT_SECRET must be unique and at least 32 bytes; production requires explicit CORS origins. Ignored environment files and template values are not included in this pack.

## Docker and Production Deployment

Dockerfile pins Node 24.21.0-bookworm-slim. Its two-stage build installs production dependencies, keeps the native compilation toolchain outside the runtime stage, verifies bcrypt, and runs as non-root node. .dockerignore restricts build inputs to manifests and API runtime sources, excluding environment files and shared playbook content.

compose.yaml injects .env.production, fixes production mode and port 8080, publishes no host ports, and joins the external shared msd-proxy network. Separately managed Caddy proxies to movie-api:8080; the documented path requires TRUST_PROXY_HOPS=1. MongoDB Atlas remains external. MOVIE_API_IMAGE_TAG is a separate Compose interpolation variable: unset/empty values fall back to local, so service updates must retain the intended release tag.

Compose configures restart: unless-stopped, init signal handling, a 45-second shutdown grace period, bounded local logs, and an HTTP-only welcome-route healthcheck. The probe does not query Atlas; unhealthy status alone does not trigger restart.

## Documentation and Verification Boundaries

README.md documents architecture, endpoints, local setup, variables, scripts, models, authentication, API behavior, and ISC licensing. docs/deployment.md covers local smoke tests, Atlas readiness before production launch, welcome-request retries, release-tag persistence, release commands, rollback, and troubleshooting. The current API reference is in README.md.

Repository configuration and documented deployment context are distinct from live verification. Deployed image/Node version, VPS OS/path, shared Caddy configuration/certificate persistence, API DNS proxy mode/IPv6, Atlas permissions/backups, and live CORS settings require production verification. Shared Caddy infrastructure and playbook are managed separately.
