const jwt = require("jsonwebtoken"),
  passport = require("passport");
const { body, validationResult } = require("express-validator");
const { jwtSecret } = require("./config");

require("./passport"); // Your local passport file

let generateJWTToken = (user) => {
  return jwt.sign(user, jwtSecret, {
    subject: user.Username, // This is the username you're encoding in the JWT
    expiresIn: "7d", // This specifies that the token will expire in 7 days
    algorithm: "HS256", // This is the algorithm used to "sign" or encode the values of the JWT
  });
};

// POST login user

/**
 * @description Login user
 * @example
 * Authentication: None
 * @name POST /login
 * @example
 * Request data format
 * {
 *  "Username": "",
 *  "Password": ""
 * }
 * @example
 * Response data format
 * {
 *   user: {
 *     "_id": ObjectID,
 *     "Username": "",
 *     "Password": "",
 *     "Email": "",
 *     "Birthday": "",
 *     "FavoriteMovies": [ObjectID]
 *   },
 *   token: ""
 * }
 */

module.exports = (router) => {
  router.post(
    "/login",
    [
      body("Username").isString().trim().notEmpty(),
      body("Password").isString().notEmpty(),
    ],
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ message: "Invalid login credentials" });
      }

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
        req.login(user, { session: false }, (loginError) => {
          if (loginError) {
            return next(loginError);
          }
          let token = generateJWTToken(user.toJSON());
          return res.json({ user, token });
        });
      })(req, res, next);
    }
  );
};
