const express = require("express");
const jwt = require("jsonwebtoken");
const passport = require("passport");
const { body } = require("express-validator");
const { jwtSecret } = require("../config");
const { validateLoginRequest } = require("../middleware/validation");

const router = express.Router();

const generateJWTToken = (user) =>
  jwt.sign(user, jwtSecret, {
    subject: user.Username,
    expiresIn: "7d",
    algorithm: "HS256",
  });

router.post(
  "/",
  [
    body("Username").isString().trim().notEmpty(),
    body("Password").isString().notEmpty(),
    validateLoginRequest,
  ],
  (req, res, next) => {
    passport.authenticate("local", { session: false }, (error, user) => {
      if (error) {
        return next(error);
      }
      if (!user) {
        return res.status(400).json({
          message: "Something is not right",
          user: user,
        });
      }
      return req.login(user, { session: false }, (loginError) => {
        if (loginError) {
          return next(loginError);
        }
        const token = generateJWTToken(user.toJSON());
        return res.json({ user, token });
      });
    })(req, res, next);
  }
);

module.exports = router;
