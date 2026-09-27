const mongoose = require("mongoose");
const { Movie, User } = require("../models");

const loadRequestedUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ Username: req.params.Username });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.requestedUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

const validateFavoriteMovie = async (req, res, next) => {
  if (!mongoose.isObjectIdOrHexString(req.params.MovieID)) {
    return res.status(400).json({ message: "MovieID must be a valid MongoDB ObjectId" });
  }

  try {
    const movieExists = await Movie.exists({ _id: req.params.MovieID });
    if (!movieExists) {
      return res.status(404).json({ message: "Movie not found" });
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { loadRequestedUser, validateFavoriteMovie };
