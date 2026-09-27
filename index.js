const express = require("express");
const { MemoryStore, rateLimit } = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const uuid = require("uuid");
const mongoose = require("mongoose");
const { check, validationResult } = require("express-validator");
const cors = require("cors");
const passport = require("passport");
const config = require("./config");
const Models = require("./models.js");

const app = express();
const Movies = Models.Movie;
const Users = Models.User;

const loadRequestedUser = async (req, res, next) => {
  try {
    const user = await Users.findOne({ Username: req.params.Username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.requestedUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const requireSelf = (req, res, next) => {
  if (req.user.Username !== req.params.Username) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
};

const validateFavoriteMovie = async (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.MovieID)) {
    return res.status(400).json({ message: "MovieID must be a valid MongoDB ObjectId" });
  }

  try {
    const movieExists = await Movies.exists({ _id: req.params.MovieID });
    if (!movieExists) {
      return res.status(404).json({ message: "Movie not found" });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

const corsOptions = {
  origin(origin, callback) {
    if (!origin || config.corsAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error("Origin not allowed");
    error.status = 403;
    return callback(error);
  },
};

const apiLimiter = rateLimit({
  windowMs: config.apiRateLimitWindowMs,
  limit: config.apiRateLimitMax,
  legacyHeaders: false,
  standardHeaders: "draft-7",
  handler: (req, res) =>
    res.status(429).json({ message: "Too many requests. Please try again later." }),
});

const loginLimiterStore = new MemoryStore();
const loginLimiter = rateLimit({
  windowMs: config.loginRateLimitWindowMs,
  limit: config.loginRateLimitMax,
  store: loginLimiterStore,
  legacyHeaders: false,
  standardHeaders: "draft-7",
  handler: (req, res) =>
    res.status(429).json({ message: "Too many login attempts. Please try again later." }),
});

// Middleware
app.use(helmet());
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
app.use(apiLimiter);
app.use(express.json({ limit: config.jsonBodyLimit }));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true, limit: config.jsonBodyLimit }));
app.use(cors(corsOptions));

// Passport and Auth
require("./passport");
app.use("/login", loginLimiter);
app.locals.loginLimiterStore = loginLimiterStore;
const auth = require("./auth")(app);

/**
 * @description Add a user
 * @name POST /users/
 * @example
 * Authentication: none
 * Request data format
 * {
 *  "Username": "",
 *  "Password": "",
 *  "Email": "",
 *  "Birthday": ""
 * }
 * @example
 * Response data format
 * {
 *   "_id": ObjectID,
 *   "Username": "",
 *   "Password": "",
 *   "Email": "",
 *   "Birthday": "",
 *   "FavoriteMovies": [ObjectID]
 * }
 */
app.post(
  "/users",
  [
    check("Username", "Username is required").isLength({ min: 5 }),
    check(
      "Username",
      "Username contains non-alphanumeric characters - not allowed."
    ).isAlphanumeric(),
    check("Password", "Password is required").not().isEmpty(),
    check("Email", "Email does not appear to be valid").isEmail(),
  ],
  async (req, res, next) => {
    // Check the validation object for errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    // Encrypt the password and check if user exists
    try {
      const hashedPassword = Users.hashPassword(req.body.Password);
      const existingUser = await Users.findOne({ Username: req.body.Username });
      if (existingUser) {
        return res.status(400).send(req.body.Username + " already exists");
      }

      const newUser = await Users.create({
        Username: req.body.Username,
        Password: hashedPassword,
        Email: req.body.Email,
        Birthday: req.body.Birthday,
      });
      res.status(201).json(newUser);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Add a movie to a user's favorite list of movies
 * @name POST /users/:Username/movies/:MovieID
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * {
 *   "UserName": "",
 *   "MovieID": ObjectID
 * }
 * @example
 * Response data format
 * {
 *   "FavoriteMovies": [ObjectID]
 * }
 */
app.post(
  "/users/:Username/movies/:MovieID",
  passport.authenticate("jwt", { session: false }),
  loadRequestedUser,
  requireSelf,
  validateFavoriteMovie,
  async (req, res, next) => {
    try {
      const updatedUser = await Users.findByIdAndUpdate(
        req.requestedUser._id,
        { $addToSet: { FavoriteMovies: req.params.MovieID } },
        { new: true }
      );
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Delete a user by username
 * @name DELETE /users/:Username
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * {
 *  "Username": ""
 * }
 * @example
 * Response data format
 * none
 */
app.delete(
  "/users/:Username",
  passport.authenticate("jwt", { session: false }),
  loadRequestedUser,
  requireSelf,
  async (req, res, next) => {
    try {
      await Users.findByIdAndDelete(req.requestedUser._id);
      res.status(200).send(req.params.Username + " was deleted.");
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Delete a movie from a user's favorite list of movies
 * @name DELETE /users/:Username/movies/:MovieID
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * {
 *  "Username": "",
 * "MovieID": ObjectID
 * }
 * @example
 * Response data format
 * {
 *  "FavoriteMovies": [ObjectID]
 * }
 */
app.delete(
  "/users/:Username/movies/:MovieID",
  passport.authenticate("jwt", { session: false }),
  loadRequestedUser,
  requireSelf,
  validateFavoriteMovie,
  async (req, res, next) => {
    try {
      const updatedUser = await Users.findByIdAndUpdate(
        req.requestedUser._id,
        { $pull: { FavoriteMovies: req.params.MovieID } },
        { new: true }
      );
      res.json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Update a user's info, by username
 * @name PUT /users/:Username
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * {
 * "Username": "",
 * "Password": "",
 * "Email": "",
 * "Birthday": ""
 * }
 * @example
 * Response data format
 * {
 *  "_id": ObjectID,
 * "Username": "",
 * "Password": "",
 * "Email": "",
 * "Birthday": "",
 * "FavoriteMovies": [ObjectID]
 * }
 */
app.put(
  "/users/:Username",
  [
    check("Username", "Username is required").isString().not().isEmpty(),
    check("Password", "Password is required").isString().not().isEmpty(),
    check("Email", "Email does not appear to be valid").isEmail(),
    check("Birthday", "Birthday must be a valid date")
      .optional({ checkFalsy: true })
      .isISO8601(),
  ],
  passport.authenticate("jwt", { session: false }),
  loadRequestedUser,
  requireSelf,
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }

    try {
      const updatedUser = await Users.findByIdAndUpdate(
        req.requestedUser._id,
        {
          $set: {
            Username: req.body.Username,
            Password: Users.hashPassword(req.body.Password),
            Email: req.body.Email,
            Birthday: req.body.Birthday,
          },
        },
        { new: true }
      );
      res.status(201).json(updatedUser);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Get all users
 * @name GET /users
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * none
 * @example
 * Response data format
 * [
 *   {
 *     _id: ObjectID
 *     "Username": "",
 *     "Password": "",
 *     "Email": "",
 *     "Birthday": "",
 *     "FavoriteMovies": [ObjectID]
 *   }
 * ]
 */
app.get(
  "/users",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    try {
      const users = await Users.find();
      res.status(200).json(users);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Get a user's info, by username
 * @name GET /users/:Username
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * {
 * "Username": "",
 * "Password": ""
 * }
 * @example
 * Response data format
 * {
 *  "_id": ObjectID,
 * "Username": "",
 * "Password": "",
 * "Email": "",
 * "Birthday": "",
 * "FavoriteMovies": [ObjectID]
 * }
 */
app.get(
  "/users/:Username",
  passport.authenticate("jwt", { session: false }),
  loadRequestedUser,
  requireSelf,
  (req, res) => {
    res.json(req.requestedUser);
  }
);

/**
 * @description Get all movies
 * @name GET /movies
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * none
 * @example
 * Response data format
 * [
 *   {
 *     _id: ObjectID,
 *     "Title": "",
 *     "Description": "",
 *     "Genre": ObjectID,
 *     "Director": [ObjectID],
 *     "ImagePath": "",
 *     "Featured": Boolean
 *   }
 * ]
 */
app.get(
  "/movies",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    try {
      const movies = await Movies.find();
      res.status(200).json(movies);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Get a movie by title
 * @name GET /movies/:Title
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * {
 * "Title": ""
 * }
 * @example
 * Response data format
 * {
 *   _id: ObjectID,
 *   "Title": "",
 *   "Description": "",
 *   "Genre": ObjectID,
 *   "Director": [ObjectID],
 *   "ImagePath": "",
 *   "Featured": Boolean
 * }
 */
app.get(
  "/movies/:Title",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    try {
      const movie = await Movies.findOne({ Title: req.params.Title });
      if (!movie) {
        return res.status(404).json({ message: "Movie not found" });
      }
      res.json(movie);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Get movies by genre
 * @name GET /movies/genre/:Name
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * {
 * "Name": ""
 * }
 * @example
 * Response data format
 * [
 *   {
 *     _id: ObjectID,
 *     "Title": "",
 *     "Description": "",
 *     "Genre": ObjectID,
 *     "Director": [ObjectID],
 *     "ImagePath": "",
 *     "Featured": Boolean
 *   }
 * ]
 */
app.get(
  "/movies/genre/:Name",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    try {
      const movies = await Movies.find({ "Genre.Name": req.params.Name });
      res.json(movies);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Get movies by director
 * @name GET /movies/director/:Name
 * @example
 * Authentication: Bearer token (JWT)
 * @example
 * Request data format
 * {
 * "Name": ""
 * }
 * @example
 * Response data format
 * [
 *   {
 *     _id: ObjectID,
 *     "Title": "",
 *     "Description": "",
 *     "Genre": ObjectID,
 *     "Director": [ObjectID],
 *     "ImagePath": "",
 *     "Featured": Boolean
 *   }
 * ]
 */
app.get(
  "/movies/director/:Name",
  passport.authenticate("jwt", { session: false }),
  async (req, res, next) => {
    try {
      const movies = await Movies.find({ "Director.Name": req.params.Name });
      res.json(movies);
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @description Landing Page welcome text
 * @name GET /
 * @example
 * Authentication: none
 * @example
 * Request data format
 * none
 * @example
 * Response data format
 * "Welcome to MyFlix!"
 */
app.get("/", (req, res) => {
  res.send("Welcome to MyFlix!");
});

/**
 * @description Handle errors
 * @name Use Error Handler
 * @example
 * Authentication: none
 * @example
 * Request data format
 * none
 * @example
 * Response data format
 * "Something broke!"
 */
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body too large" });
  }

  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ message: "Invalid JSON request body" });
  }

  if (err.status === 403 && err.message === "Origin not allowed") {
    return res.status(403).json({ message: "Origin not allowed" });
  }

  console.error("Unhandled request error", err.name || "Error");
  return res.status(500).json({ message: "Internal server error" });
});

// Start the HTTP server only when this file is executed directly. Exporting the
// configured app lets the contract test suite exercise the same routes without
// opening a listener or connecting to a non-test database at module load time.
if (require.main === module) {
  mongoose.connect(process.env.CONNECTION_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const port = process.env.PORT || 8080;
  app.listen(port, "0.0.0.0", () => {
    console.log("Listening on Port " + port);
  });
}

module.exports = app;
