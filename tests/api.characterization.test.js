const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const testJwtSecret = "phase-2-test-secret-that-is-long-enough-to-be-safe";
process.env.JWT_SECRET = testJwtSecret;

const app = require("../index");
const Models = require("../models");

const Movies = Models.Movie;
const Users = Models.User;

let mongoServer;
let primaryUser;
let secondaryUser;
let movie;

const authHeaderFor = (user) => ({
  Authorization: `Bearer ${jwt.sign(user.toJSON(), testJwtSecret, {
    algorithm: "HS256",
    expiresIn: "7d",
    subject: user.Username,
  })}`,
});

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  movie = await Movies.create({
    Title: "Characterization Movie",
    Description: "A fixture used only by the API characterization suite.",
    Genre: { Name: "Drama", Description: "Drama fixture" },
    Director: { Name: "Fixture Director", Bio: "Fixture biography" },
    ImagePath: "/fixture.jpg",
    Featured: true,
  });

  primaryUser = await Users.create({
    Username: "primary-user",
    Password: Users.hashPassword("primary-password"),
    Email: "primary@example.test",
  });
  secondaryUser = await Users.create({
    Username: "secondary-user",
    Password: Users.hashPassword("secondary-password"),
    Email: "secondary@example.test",
  });
});

after(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

test("GET / returns the legacy welcome text", async () => {
  const response = await request(app).get("/");

  assert.equal(response.status, 200);
  assert.equal(response.text, "Welcome to MyFlix!");
});

test("missing or placeholder JWT_SECRET prevents the application from starting", () => {
  const projectRoot = path.resolve(__dirname, "..");

  for (const JWT_SECRET of [undefined, "your_jwt_secret", "replace-with-a-long-random-secret"]) {
    const result = spawnSync(process.execPath, ["-e", "require('./index')"], {
      cwd: projectRoot,
      env: { ...process.env, JWT_SECRET },
      encoding: "utf8",
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /JWT_SECRET must be configured/);
  }
});

test("POST /users retains registration validation and omits Password from its response", async () => {
  const invalidResponse = await request(app).post("/users").send({});
  assert.equal(invalidResponse.status, 422);
  assert.ok(Array.isArray(invalidResponse.body.errors));

  const response = await request(app).post("/users").send({
    Username: "registereduser",
    Password: "registered-password",
    Email: "registered@example.test",
    Birthday: "1990-01-01",
  });

  assert.equal(response.status, 201);
  assert.equal(response.body.Username, "registereduser");
  assert.equal(Object.hasOwn(response.body, "Password"), false);
});

test("POST /login returns a configured JWT and omits Password without credential logging", async () => {
  const originalConsoleLog = console.log;
  const loggedValues = [];
  console.log = (...args) => loggedValues.push(args);

  let response;
  try {
    response = await request(app).post("/login").send({
      Username: primaryUser.Username,
      Password: "primary-password",
    });
  } finally {
    console.log = originalConsoleLog;
  }

  assert.equal(response.status, 200);
  assert.equal(response.body.user.Username, primaryUser.Username);
  assert.equal(Object.hasOwn(response.body.user, "Password"), false);
  assert.equal(typeof response.body.token, "string");
  assert.equal(loggedValues.length, 0);

  const tokenResponse = await request(app)
    .get("/movies")
    .set({ Authorization: `Bearer ${response.body.token}` });
  assert.equal(tokenResponse.status, 200);
});

test("POST /login rejects incorrect credentials without exposing the submitted password", async () => {
  const response = await request(app).post("/login").send({
    Username: primaryUser.Username,
    Password: "incorrect-password",
  });

  assert.equal(response.status, 400);
  assert.equal(JSON.stringify(response.body).includes("incorrect-password"), false);
});

test("protected endpoints reject requests without a bearer token or with an invalid JWT", async () => {
  const response = await request(app).get("/movies");
  const invalidToken = jwt.sign(primaryUser.toJSON(), "different-test-secret-that-is-long-enough", {
    algorithm: "HS256",
    expiresIn: "7d",
  });
  const invalidTokenResponse = await request(app)
    .get("/movies")
    .set({ Authorization: `Bearer ${invalidToken}` });

  assert.equal(response.status, 401);
  assert.equal(invalidTokenResponse.status, 401);
});

test("movie retrieval routes preserve fields and successful response shapes", async () => {
  const headers = authHeaderFor(primaryUser);
  const allMovies = await request(app).get("/movies").set(headers);
  const byTitle = await request(app)
    .get(`/movies/${encodeURIComponent(movie.Title)}`)
    .set(headers);
  const byGenre = await request(app).get("/movies/genre/Drama").set(headers);
  const byDirector = await request(app)
    .get("/movies/director/Fixture%20Director")
    .set(headers);

  assert.equal(allMovies.status, 200);
  assert.equal(allMovies.body[0].Title, movie.Title);
  assert.equal(byTitle.status, 200);
  assert.equal(byTitle.body._id, movie.id);
  assert.equal(byGenre.status, 200);
  assert.equal(byGenre.body[0].Genre.Name, "Drama");
  assert.equal(byDirector.status, 200);
  assert.equal(byDirector.body[0].Director.Name, "Fixture Director");
});

test("missing movie and user detail resources return 404", async () => {
  const headers = authHeaderFor(primaryUser);
  const missingMovie = await request(app).get("/movies/No%20such%20movie").set(headers);
  const missingUser = await request(app).get("/users/no-such-user").set(headers);

  assert.equal(missingMovie.status, 404);
  assert.deepEqual(missingMovie.body, { message: "Movie not found" });
  assert.equal(missingUser.status, 404);
  assert.deepEqual(missingUser.body, { message: "User not found" });
});

test("GET /users retains broad authenticated access without exposing Password", async () => {
  const headers = authHeaderFor(primaryUser);
  const allUsers = await request(app).get("/users").set(headers);

  assert.equal(allUsers.status, 200);
  assert.ok(allUsers.body.some((user) => user.Username === secondaryUser.Username));
  assert.ok(allUsers.body.every((user) => !Object.hasOwn(user, "Password")));
});

test("GET /users/:Username permits self access and rejects another user", async () => {
  const ownUser = await request(app)
    .get(`/users/${primaryUser.Username}`)
    .set(authHeaderFor(primaryUser));
  const otherUser = await request(app)
    .get(`/users/${secondaryUser.Username}`)
    .set(authHeaderFor(primaryUser));

  assert.equal(ownUser.status, 200);
  assert.equal(ownUser.body.Username, primaryUser.Username);
  assert.equal(Object.hasOwn(ownUser.body, "Password"), false);
  assert.equal(otherUser.status, 403);
  assert.deepEqual(otherUser.body, { message: "Forbidden" });
});

test("PUT /users/:Username hashes replacement passwords, omits Password, and permits login with the new password", async () => {
  const response = await request(app)
    .put(`/users/${primaryUser.Username}`)
    .set(authHeaderFor(primaryUser))
    .send({
      Username: primaryUser.Username,
      Password: "unhashed-characterization-password",
      Email: "primary-updated@example.test",
      Birthday: "1991-01-01",
    });

  const storedUser = await Users.findById(primaryUser.id);
  assert.equal(response.status, 201);
  assert.equal(Object.hasOwn(response.body, "Password"), false);
  assert.notEqual(storedUser.Password, "unhashed-characterization-password");
  assert.match(storedUser.Password, /^\$2[aby]\$/);

  const loginResponse = await request(app).post("/login").send({
    Username: primaryUser.Username,
    Password: "unhashed-characterization-password",
  });
  assert.equal(loginResponse.status, 200);
});

test("PUT /users/:Username rejects an authenticated cross-user update", async () => {
  const response = await request(app)
    .put(`/users/${secondaryUser.Username}`)
    .set(authHeaderFor(primaryUser))
    .send({
      Username: secondaryUser.Username,
      Password: "not-applied",
      Email: secondaryUser.Email,
    });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { message: "Forbidden" });
});

test("favourite addition is idempotent for the authenticated user", async () => {
  const headers = authHeaderFor(primaryUser);
  const first = await request(app)
    .post(`/users/${primaryUser.Username}/movies/${movie.id}`)
    .set(headers);
  const second = await request(app)
    .post(`/users/${primaryUser.Username}/movies/${movie.id}`)
    .set(headers);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.Username, primaryUser.Username);
  assert.equal(second.body.FavoriteMovies.length, 1);
  assert.equal(Object.hasOwn(second.body, "Password"), false);
});

test("favourite removal succeeds for the authenticated user", async () => {
  const response = await request(app)
    .delete(`/users/${primaryUser.Username}/movies/${movie.id}`)
    .set(authHeaderFor(primaryUser));

  assert.equal(response.status, 200);
  assert.equal(response.body.Username, primaryUser.Username);
  assert.deepEqual(response.body.FavoriteMovies, []);
  assert.equal(Object.hasOwn(response.body, "Password"), false);
});

test("favourite routes reject cross-user changes and validate MovieID resources", async () => {
  const headers = authHeaderFor(primaryUser);
  const crossUserAdd = await request(app)
    .post(`/users/${secondaryUser.Username}/movies/${movie.id}`)
    .set(headers);
  const crossUserDelete = await request(app)
    .delete(`/users/${secondaryUser.Username}/movies/${movie.id}`)
    .set(headers);
  const missingMovie = await request(app)
    .post(`/users/${primaryUser.Username}/movies/${new mongoose.Types.ObjectId()}`)
    .set(headers);
  const malformedMovie = await request(app)
    .post(`/users/${primaryUser.Username}/movies/not-a-mongo-id`)
    .set(headers);
  const missingUser = await request(app)
    .post(`/users/no-such-user/movies/${movie.id}`)
    .set(headers);

  assert.equal(crossUserAdd.status, 403);
  assert.deepEqual(crossUserAdd.body, { message: "Forbidden" });
  assert.equal(crossUserDelete.status, 403);
  assert.deepEqual(crossUserDelete.body, { message: "Forbidden" });
  assert.equal(missingMovie.status, 404);
  assert.deepEqual(missingMovie.body, { message: "Movie not found" });
  assert.equal(malformedMovie.status, 400);
  assert.deepEqual(malformedMovie.body, {
    message: "MovieID must be a valid MongoDB ObjectId",
  });
  assert.equal(missingUser.status, 404);
  assert.deepEqual(missingUser.body, { message: "User not found" });
});

test("DELETE /users/:Username rejects cross-user deletion and permits self deletion", async () => {
  const deletableUser = await Users.create({
    Username: "deletable-user",
    Password: Users.hashPassword("deletable-password"),
    Email: "deletable@example.test",
  });
  const crossUserResponse = await request(app)
    .delete(`/users/${secondaryUser.Username}`)
    .set(authHeaderFor(primaryUser));
  const selfResponse = await request(app)
    .delete(`/users/${deletableUser.Username}`)
    .set(authHeaderFor(deletableUser));

  assert.equal(crossUserResponse.status, 403);
  assert.deepEqual(crossUserResponse.body, { message: "Forbidden" });
  assert.notEqual(await Users.findById(secondaryUser.id), null);
  assert.equal(selfResponse.status, 200);
  assert.equal(selfResponse.text, `${deletableUser.Username} was deleted.`);
  assert.equal(await Users.findById(deletableUser.id), null);
});
