const { after, before, test } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const app = require("../index");
const Models = require("../models");

const Movies = Models.Movie;
const Users = Models.User;
const legacyJwtSecret = "your_jwt_secret";

let mongoServer;
let primaryUser;
let secondaryUser;
let movie;

const authHeaderFor = (user) => ({
  Authorization: `Bearer ${jwt.sign(user.toJSON(), legacyJwtSecret, {
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

test("POST /users retains registration validation, response status, and password exposure", async () => {
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
  assert.match(response.body.Password, /^\$2[aby]\$/);
});

test("POST /login returns the legacy user/token response and exposes the password hash", async () => {
  const response = await request(app).post("/login").send({
    Username: primaryUser.Username,
    Password: "primary-password",
  });

  assert.equal(response.status, 200);
  assert.equal(response.body.user.Username, primaryUser.Username);
  assert.match(response.body.user.Password, /^\$2[aby]\$/);
  assert.equal(typeof response.body.token, "string");
});

test("protected endpoints reject requests without a bearer token", async () => {
  const response = await request(app).get("/movies");

  assert.equal(response.status, 401);
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

test("missing single resources currently return 200 with a null JSON body", async () => {
  const headers = authHeaderFor(primaryUser);
  const missingMovie = await request(app).get("/movies/No%20such%20movie").set(headers);
  const missingUser = await request(app).get("/users/no-such-user").set(headers);

  assert.equal(missingMovie.status, 200);
  assert.equal(missingMovie.body, null);
  assert.equal(missingUser.status, 200);
  assert.equal(missingUser.body, null);
});

test("GET /users and GET /users/:Username expose all users and password hashes to an authenticated user", async () => {
  const headers = authHeaderFor(primaryUser);
  const allUsers = await request(app).get("/users").set(headers);
  const otherUser = await request(app).get(`/users/${secondaryUser.Username}`).set(headers);

  assert.equal(allUsers.status, 200);
  assert.ok(allUsers.body.some((user) => user.Username === secondaryUser.Username));
  assert.match(allUsers.body[0].Password, /^\$2[aby]\$/);
  assert.equal(otherUser.status, 200);
  assert.equal(otherUser.body.Username, secondaryUser.Username);
  assert.match(otherUser.body.Password, /^\$2[aby]\$/);
});

test("PUT /users/:Username permits self updates, returns 201, and stores a supplied password unchanged", async () => {
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
  assert.equal(response.body.Password, "unhashed-characterization-password");
  assert.equal(storedUser.Password, "unhashed-characterization-password");
});

test("PUT /users/:Username rejects an authenticated cross-user update with the legacy response", async () => {
  const response = await request(app)
    .put(`/users/${secondaryUser.Username}`)
    .set(authHeaderFor(primaryUser))
    .send({
      Username: secondaryUser.Username,
      Password: "not-applied",
      Email: secondaryUser.Email,
    });

  assert.equal(response.status, 400);
  assert.equal(response.text, "Permission denied");
});

test("favourite mutations allow cross-user writes and duplicate movie references", async () => {
  const headers = authHeaderFor(primaryUser);
  const first = await request(app)
    .post(`/users/${secondaryUser.Username}/movies/${movie.id}`)
    .set(headers);
  const second = await request(app)
    .post(`/users/${secondaryUser.Username}/movies/${movie.id}`)
    .set(headers);

  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(second.body.Username, secondaryUser.Username);
  assert.equal(second.body.FavoriteMovies.length, 2);
});

test("DELETE /users/:Username/movies/:MovieID permits a cross-user favourite removal", async () => {
  const response = await request(app)
    .delete(`/users/${secondaryUser.Username}/movies/${movie.id}`)
    .set(authHeaderFor(primaryUser));

  assert.equal(response.status, 200);
  assert.equal(response.body.Username, secondaryUser.Username);
  assert.deepEqual(response.body.FavoriteMovies, []);
});

test("DELETE /users/:Username permits cross-user deletion and preserves its legacy response", async () => {
  const deletableUser = await Users.create({
    Username: "deletable-user",
    Password: Users.hashPassword("deletable-password"),
    Email: "deletable@example.test",
  });
  const response = await request(app)
    .delete(`/users/${deletableUser.Username}`)
    .set(authHeaderFor(primaryUser));

  assert.equal(response.status, 200);
  assert.equal(response.text, `${deletableUser.Username} was deleted.`);
  assert.equal(await Users.findById(deletableUser.id), null);
});
