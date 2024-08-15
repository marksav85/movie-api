const express = require("express");
const morgan = require("morgan");
const uuid = require("uuid");
const mongoose = require("mongoose");
const { check, validationResult } = require("express-validator");
const cors = require("cors");
const passport = require("passport");
const Models = require("./models.js");

const app = express();
const Movies = Models.Movie;
const Users = Models.User;

// Connect to MongoDB
mongoose.connect(process.env.CONNECTION_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Middleware
app.use(morgan("common"));
app.use(express.json());
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Passport and Auth
require("./passport");
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
  async (req, res) => {
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
      console.error(error);
      res.status(500).send("Error: " + error);
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
  async (req, res) => {
    try {
      const updatedUser = await Users.findOneAndUpdate(
        { Username: req.params.Username },
        { $push: { FavoriteMovies: req.params.MovieID } },
        { new: true }
      );
      res.json(updatedUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  async (req, res) => {
    try {
      const user = await Users.findOneAndRemove({
        Username: req.params.Username,
      });
      if (!user) {
        res.status(400).send(req.params.Username + " was not found");
      } else {
        res.status(200).send(req.params.Username + " was deleted.");
      }
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  async (req, res) => {
    try {
      const updatedUser = await Users.findOneAndUpdate(
        { Username: req.params.Username },
        { $pull: { FavoriteMovies: req.params.MovieID } },
        { new: true }
      );
      res.json(updatedUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    // Check for permission
    if (req.user.Username !== req.params.Username) {
      return res.status(400).send("Permission denied");
    }

    try {
      const updatedUser = await Users.findOneAndUpdate(
        { Username: req.params.Username },
        {
          $set: {
            Username: req.body.Username,
            Password: req.body.Password,
            Email: req.body.Email,
            Birthday: req.body.Birthday,
          },
        },
        { new: true }
      );
      res.status(201).json(updatedUser);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  async (req, res) => {
    try {
      const users = await Users.find();
      res.status(200).json(users);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  async (req, res) => {
    try {
      const user = await Users.findOne({ Username: req.params.Username });
      res.json(user);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
    }
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
  async (req, res) => {
    try {
      const movies = await Movies.find();
      res.status(200).json(movies);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  async (req, res) => {
    try {
      const movie = await Movies.findOne({ Title: req.params.Title });
      res.json(movie);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  async (req, res) => {
    try {
      const movies = await Movies.find({ "Genre.Name": req.params.Name });
      res.json(movies);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  async (req, res) => {
    try {
      const movies = await Movies.find({ "Director.Name": req.params.Name });
      res.json(movies);
    } catch (error) {
      console.error(error);
      res.status(500).send("Error: " + error);
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
  console.error(err.stack);
  res.status(500).send("Something broke!");
});

// Listen for requests
const port = process.env.PORT || 8080;
app.listen(port, "0.0.0.0", () => {
  console.log("Listening on Port " + port);
});
