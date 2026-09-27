const express = require("express");
const passport = require("passport");
const { Movie } = require("../models");

const router = express.Router();
const requireJwt = passport.authenticate("jwt", { session: false });

router.get("/", requireJwt, async (req, res, next) => {
  try {
    const movies = await Movie.find();
    return res.status(200).json(movies);
  } catch (error) {
    return next(error);
  }
});

router.get("/:Title", requireJwt, async (req, res, next) => {
  try {
    const movie = await Movie.findOne({ Title: req.params.Title });
    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }
    return res.json(movie);
  } catch (error) {
    return next(error);
  }
});

router.get("/genre/:Name", requireJwt, async (req, res, next) => {
  try {
    const movies = await Movie.find({ "Genre.Name": req.params.Name });
    return res.json(movies);
  } catch (error) {
    return next(error);
  }
});

router.get("/director/:Name", requireJwt, async (req, res, next) => {
  try {
    const movies = await Movie.find({ "Director.Name": req.params.Name });
    return res.json(movies);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
