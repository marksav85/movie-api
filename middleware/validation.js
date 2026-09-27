const { validationResult } = require("express-validator");

const validationErrors = (status, bodyForErrors) => (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return res.status(status).json(bodyForErrors(errors));
};

const validateRequest = validationErrors(422, (errors) => ({ errors: errors.array() }));
const validateLoginRequest = validationErrors(400, () => ({
  message: "Invalid login credentials",
}));

module.exports = { validateLoginRequest, validateRequest };
