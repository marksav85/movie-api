const express = require("express");
const passport = require("passport");
const { check } = require("express-validator");
const { User } = require("../models");
const { requireSelf } = require("../middleware/authorization");
const { loadRequestedUser, validateFavoriteMovie } = require("../middleware/resources");
const { validateRequest } = require("../middleware/validation");

const router = express.Router();
const requireJwt = passport.authenticate("jwt", { session: false });

router.post(
  "/",
  [
    check("Username", "Username is required").isLength({ min: 5 }),
    check("Username", "Username contains non-alphanumeric characters - not allowed.").isAlphanumeric(),
    check("Password", "Password is required").not().isEmpty(),
    check("Email", "Email does not appear to be valid").isEmail(),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const hashedPassword = User.hashPassword(req.body.Password);
      const existingUser = await User.findOne({ Username: req.body.Username });
      if (existingUser) {
        return res.status(400).send(req.body.Username + " already exists");
      }

      const newUser = await User.create({
        Username: req.body.Username,
        Password: hashedPassword,
        Email: req.body.Email,
        Birthday: req.body.Birthday,
      });
      return res.status(201).json(newUser);
    } catch (error) {
      return next(error);
    }
  }
);

router.post(
  "/:Username/movies/:MovieID",
  requireJwt,
  loadRequestedUser,
  requireSelf,
  validateFavoriteMovie,
  async (req, res, next) => {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.requestedUser._id,
        { $addToSet: { FavoriteMovies: req.params.MovieID } },
        { new: true }
      );
      return res.json(updatedUser);
    } catch (error) {
      return next(error);
    }
  }
);

router.delete("/:Username", requireJwt, loadRequestedUser, requireSelf, async (req, res, next) => {
  try {
    await User.findByIdAndDelete(req.requestedUser._id);
    return res.status(200).send(req.params.Username + " was deleted.");
  } catch (error) {
    return next(error);
  }
});

router.delete(
  "/:Username/movies/:MovieID",
  requireJwt,
  loadRequestedUser,
  requireSelf,
  validateFavoriteMovie,
  async (req, res, next) => {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.requestedUser._id,
        { $pull: { FavoriteMovies: req.params.MovieID } },
        { new: true }
      );
      return res.json(updatedUser);
    } catch (error) {
      return next(error);
    }
  }
);

router.put(
  "/:Username",
  [
    check("Username", "Username is required").isString().not().isEmpty(),
    check("Password", "Password is required").isString().not().isEmpty(),
    check("Email", "Email does not appear to be valid").isEmail(),
    check("Birthday", "Birthday must be a valid date").optional({ checkFalsy: true }).isISO8601(),
    validateRequest,
  ],
  requireJwt,
  loadRequestedUser,
  requireSelf,
  async (req, res, next) => {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.requestedUser._id,
        {
          $set: {
            Username: req.body.Username,
            Password: User.hashPassword(req.body.Password),
            Email: req.body.Email,
            Birthday: req.body.Birthday,
          },
        },
        { new: true }
      );
      return res.status(201).json(updatedUser);
    } catch (error) {
      return next(error);
    }
  }
);

router.get("/:Username", requireJwt, loadRequestedUser, requireSelf, (req, res) =>
  res.json(req.requestedUser)
);

module.exports = router;
