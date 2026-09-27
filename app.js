const express = require("express");
const { MemoryStore, rateLimit } = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const config = require("./config");
const authRouter = require("./routes/auth");
const moviesRouter = require("./routes/movies");
const usersRouter = require("./routes/users");
const { errorHandler } = require("./middleware/errors");

require("./passport");

const app = express();

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

app.use(helmet());
app.use(morgan(config.nodeEnv === "production" ? "combined" : "dev"));
app.use(apiLimiter);
app.use(express.json({ limit: config.jsonBodyLimit }));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true, limit: config.jsonBodyLimit }));
app.use(cors(corsOptions));

app.locals.loginLimiterStore = loginLimiterStore;
app.use("/login", loginLimiter, authRouter);
app.use("/users", usersRouter);
app.use("/movies", moviesRouter);
app.get("/", (req, res) => res.send("Welcome to MyFlix!"));
app.use(errorHandler);

module.exports = app;
