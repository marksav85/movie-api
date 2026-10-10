const express = require("express");
const passport = require("passport");
const { body } = require("express-validator");
const { User } = require("../models");
const { requireSelf } = require("../middleware/authorization");
const { loadRequestedUser, validateFavoriteMovie } = require("../middleware/resources");
const { validateRequest } = require("../middleware/validation");

const router = express.Router();
const requireJwt = passport.authenticate("jwt", { session: false });

router.post(
  "/",
  [
    body("Username")
      .isString().withMessage("Username must be a string.").bail()
      .isLength({ min: 5 }).withMessage("Username must be at least 5 characters long.")
      .matches(/^[A-Za-z0-9]+$/).withMessage("Username must contain only ASCII letters and numbers, without spaces or symbols."),
    body("Password")
      .isString().withMessage("Password must be a string.").bail()
      .isLength({ min: 8 }).withMessage("Password must be at least 8 characters long.")
      .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
      .withMessage("Password must not exceed 72 UTF-8 bytes.")
      .hide(),
    body("Email", "Email does not appear to be valid").isEmail(),
    body("Birthday")
      .customSanitizer((value) =>
        value === null || (typeof value === "string" && value.trim() === "") ? undefined : value
      )
      .custom((value) => {
        if (value === undefined) return true;
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(value + "T00:00:00.000Z");
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }).withMessage("Birthday must be a valid calendar date in YYYY-MM-DD format.").bail()
      .custom((value) => value === undefined || value <= new Date().toISOString().slice(0, 10))
      .withMessage("Birthday must not be in the future."),
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
        ...(req.body.Birthday === undefined ? {} : { Birthday: req.body.Birthday }),
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
  requireJwt,
  loadRequestedUser,
  requireSelf,
  [
    body("Username")
      .isString().withMessage("Username must be a string.").bail()
      .notEmpty().withMessage("Username is required.").bail()
      .if((value, { req }) => value !== req.requestedUser.Username)
      .isLength({ min: 5 }).withMessage("Username must be at least 5 characters long.")
      .matches(/^[A-Za-z0-9]+$/).withMessage("Username must contain only ASCII letters and numbers, without spaces or symbols."),
    body("Password")
      .customSanitizer((value) => value === "" ? undefined : value)
      .if((value) => value !== undefined)
      .isString().withMessage("Password must be a string.").bail()
      .custom((value, { req }) => [...value].length >= 8 || req.requestedUser.validatePassword(value))
      .withMessage("Password must be at least 8 characters long.")
      .custom((value) => Buffer.byteLength(value, "utf8") <= 72)
      .withMessage("Password must not exceed 72 UTF-8 bytes.")
      .hide(),
    body("Email", "Email does not appear to be valid").isEmail(),
    body("Birthday")
      .customSanitizer((value) =>
        value === null || (typeof value === "string" && value.trim() === "") ? undefined : value
      )
      .custom((value) => {
        if (value === undefined) return true;
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
        const date = new Date(value + "T00:00:00.000Z");
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      }).withMessage("Birthday must be a valid calendar date in YYYY-MM-DD format.").bail()
      .custom((value) => value === undefined || value <= new Date().toISOString().slice(0, 10))
      .withMessage("Birthday must not be in the future."),
    validateRequest,
  ],
  async (req, res, next) => {
    try {
      const updatedUser = await User.findByIdAndUpdate(
        req.requestedUser._id,
        {
          $set: {
            Username: req.body.Username,
            ...(req.body.Password === undefined ||
              ([...req.body.Password].length < 8 && req.requestedUser.validatePassword(req.body.Password))
              ? {} : { Password: User.hashPassword(req.body.Password) }),
            Email: req.body.Email,
            ...(req.body.Birthday === undefined ? {} : { Birthday: req.body.Birthday }),
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
