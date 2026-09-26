---
artifactId: CONTEXT_SUMMARY
packId: "2026-09-26T22:39:21Z"
generatedAt: "2026-09-26T22:39:21Z"
generator: "prompt--artifact--generate-context-summary.md"
---

# Context Summary

## Project Type

Legacy CommonJS Node.js Express REST API for the myFlix React and Angular clients. The application serves JSON movie and user data from MongoDB through Mongoose and also serves static content from `public/`.

## Routing Model

No framework router or `src/` directory is present. `index.js` creates the Express app, registers all routes, attaches authentication, and starts the HTTP listener. `auth.js` registers `POST /login`; `passport.js` registers local and JWT Passport strategies; `models.js` defines Mongoose models.

## Source Scope

The runtime source root is the repository root, not `src/`. The source-tree artifact therefore records four root-level JavaScript files and no source directories. This is a legacy-layout deviation from the Playbook's `src/`-oriented generator convention.

## Runtime and Configuration

`npm start` runs `node index.js`. The listener binds `0.0.0.0` and uses `PORT` with a fallback of `8080`. MongoDB is configured with the required `CONNECTION_URI` environment-variable name. No committed environment template, Render configuration, Docker configuration, or health-specific endpoint was found. The README and static documentation still describe Heroku rather than Render.

## HTTP API

Public endpoints are `GET /`, `POST /login`, and `POST /users`. JWT Bearer authentication is required by the implemented `/movies` and `/users` read/write routes. Implemented paths use case-sensitive parameter names `:Username`, `:MovieID`, `:Title`, and `:Name`.

Movie reads are `GET /movies`, `GET /movies/:Title`, `GET /movies/genre/:Name`, and `GET /movies/director/:Name`. User operations are `GET /users`, `GET /users/:Username`, `PUT /users/:Username`, `DELETE /users/:Username`, `POST /users/:Username/movies/:MovieID`, and `DELETE /users/:Username/movies/:MovieID`.

## Data Model

`Movie` stores `Title`, `Description`, embedded `Genre` (`Name`, `Description`), embedded `Director` (`Name`, `Bio`), `ImagePath`, and `Featured`. `User` stores `Username`, bcrypt password hash, `Email`, optional `Birthday`, and `FavoriteMovies` ObjectId references to `Movie`.

## Architecture and Quality Baseline

Middleware is Morgan common logging, JSON parsing, URL-encoded parsing, static public-file serving, and unrestricted CORS. Express-validator validates registration only. Error handling is per-route try/catch plus a final generic error handler. There are no implemented automated tests; the configured test script exits with an error. Checked-in `out/` HTML is generated JSDoc output and `public/documentation.html` is supporting documentation, not a verified runtime contract.
