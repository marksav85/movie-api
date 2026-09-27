---
artifactId: CONTEXT_SUMMARY
packId: "2026-09-27T13:56:15Z"
generatedAt: "2026-09-27T13:56:15Z"
generator: "prompt--artifact--generate-context-summary.md"
---

# Context Summary

## Project Type

CommonJS Node.js Express REST API for the myFlix React and Angular clients. It serves movie and user data from MongoDB through Mongoose and exposes a local API only.

## Routing Model

There is no frontend framework router or `src/` directory. The runtime source uses a root-level Express layout: `app.js` composes middleware and routers, while `index.js` connects to MongoDB and starts or gracefully shuts down the process. The artifact source scope records this equivalent root-level layout.

## Source Scope

The runtime source contains 12 JavaScript files across the repository root, `routes/`, and `middleware/`. Tests live separately in `tests/` and are excluded from the source snapshot.

## HTTP API and authorization

Public routes are `GET /`, `POST /login`, and `POST /users`. JWT Bearer authentication protects movie reads and all user operations. Movie reads are `GET /movies`, `GET /movies/:Title`, `GET /movies/genre/:Name`, and `GET /movies/director/:Name`. User routes are self-only: `GET`, `PUT`, and `DELETE /users/:Username`, plus `POST` and `DELETE /users/:Username/movies/:MovieID`. `GET /users` is retired.

## Data and security

Movies embed `Genre` and `Director` objects; user favourites reference Movie ObjectIds. User serialization removes password hashes, passwords are bcrypt-hashed on writes, favourites use `$addToSet` for idempotent addition, and favourite IDs and resources are validated. Helmet, configured CORS, request-body limits, login/API rate limits, and centralized safe errors protect requests.

## Runtime and quality

Configuration validates a required JWT secret, CORS origins, body-size limits, and rate-limit settings. `CONNECTION_URI` is required at server startup; MongoDB connects before listening. SIGINT and SIGTERM trigger listener and database shutdown. Node 24 is the declared target and Node `>=22 <25` is supported. The 23 integration and process tests use MongoDB Memory Server rather than production data. ESLint 10 uses flat config.
