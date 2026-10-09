// ARTIFACT_META: {"artifactId":"SRC_SNAPSHOT_1","packId":"2026-10-09T13:49:21Z","generatedAt":"2026-10-09T13:49:21Z","generator":"prompt--artifact--generate-snapshot.md"}
// ===== FILE: app.js =====
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
app.set("trust proxy", config.trustProxyHops);

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

// ===== FILE: config.js =====
const exampleJwtSecret = "replace-with-a-long-random-secret";
const jwtSecret = process.env.JWT_SECRET;
const nodeEnv = process.env.NODE_ENV || "development";
const trustProxyValue = process.env.TRUST_PROXY_HOPS ?? "0";
if (!/^[01]$/.test(trustProxyValue)) {
  throw new Error("TRUST_PROXY_HOPS must be 0 (direct) or 1 (Caddy only).");
}
const trustProxyHops = Number(trustProxyValue);
const developmentCorsOrigins = [
  "http://localhost:1234",
  "http://127.0.0.1:1234",
  "http://localhost:4200",
  "http://127.0.0.1:4200",
];

if (
  !jwtSecret ||
  jwtSecret === "your_jwt_secret" ||
  jwtSecret === exampleJwtSecret ||
  Buffer.byteLength(jwtSecret) < 32
) {
  throw new Error(
    "JWT_SECRET must be configured with a unique value of at least 32 bytes."
  );
}

const parsePositiveInteger = (value, variableName, fallback) => {
  const parsed = Number.parseInt(value || fallback, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${variableName} must be a positive integer.`);
  }

  return parsed;
};

const parseCorsOrigins = () => {
  if (!process.env.CORS_ALLOWED_ORIGINS) {
    if (nodeEnv === "production") {
      throw new Error("CORS_ALLOWED_ORIGINS must be configured in production.");
    }

    return developmentCorsOrigins;
  }

  const origins = process.env.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins.length || origins.includes("*")) {
    throw new Error("CORS_ALLOWED_ORIGINS must contain explicit origins and cannot use *.");
  }

  for (const origin of origins) {
    try {
      if (new URL(origin).origin !== origin) {
        throw new Error("Origin must not include a path.");
      }
    } catch {
      throw new Error("CORS_ALLOWED_ORIGINS contains an invalid origin.");
    }
  }

  return origins;
};

const corsAllowedOrigins = parseCorsOrigins();
const loginRateLimitWindowMs = parsePositiveInteger(
  process.env.LOGIN_RATE_LIMIT_WINDOW_MS,
  "LOGIN_RATE_LIMIT_WINDOW_MS",
  "900000"
);
const loginRateLimitMax = parsePositiveInteger(
  process.env.LOGIN_RATE_LIMIT_MAX,
  "LOGIN_RATE_LIMIT_MAX",
  "10"
);
const apiRateLimitWindowMs = parsePositiveInteger(
  process.env.API_RATE_LIMIT_WINDOW_MS,
  "API_RATE_LIMIT_WINDOW_MS",
  "900000"
);
const apiRateLimitMax = parsePositiveInteger(
  process.env.API_RATE_LIMIT_MAX,
  "API_RATE_LIMIT_MAX",
  "1000"
);
const jsonBodyLimit = (process.env.JSON_BODY_LIMIT || "16kb").toLowerCase();
const jsonBodyLimitMatch = /^(\d+)(kb|mb)$/.exec(jsonBodyLimit);

if (!jsonBodyLimitMatch) {
  throw new Error("JSON_BODY_LIMIT must use kb or mb units.");
}

const jsonBodyLimitBytes =
  Number.parseInt(jsonBodyLimitMatch[1], 10) *
  (jsonBodyLimitMatch[2] === "mb" ? 1024 * 1024 : 1024);

if (jsonBodyLimitBytes > 64 * 1024) {
  throw new Error("JSON_BODY_LIMIT must not exceed 64kb.");
}

module.exports = {
  apiRateLimitMax,
  apiRateLimitWindowMs,
  corsAllowedOrigins,
  jsonBodyLimit,
  jwtSecret,
  loginRateLimitMax,
  loginRateLimitWindowMs,
  nodeEnv,
  trustProxyHops,
};

// ===== FILE: index.js =====
const mongoose = require("mongoose");
const app = require("./app");

let server;
let shuttingDown = false;

const startServer = async () => {
  const connectionUri = process.env.CONNECTION_URI;
  if (!connectionUri) {
    throw new Error("CONNECTION_URI must be configured before starting the server.");
  }

  await mongoose.connect(connectionUri);

  if (shuttingDown) {
    await mongoose.connection.close();
    return undefined;
  }

  const port = process.env.PORT || 8080;
  server = app.listen(port, "0.0.0.0", () => {
    console.log("Listening on Port " + port);
  });
  return server;
};

const shutdown = async () => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;

  try {
    if (server) {
      await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
    await mongoose.connection.close();
    console.log("Shutdown complete.");
    process.exitCode = 0;
  } catch {
    console.error("Shutdown failed.");
    process.exitCode = 1;
  }
};

if (require.main === module) {
  startServer().catch(() => {
    console.error("Database connection failed. The server was not started.");
    process.exitCode = 1;
  });

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

module.exports = app;
module.exports.startServer = startServer;
module.exports.shutdown = shutdown;

// ===== FILE: models.js =====
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

let movieSchema = mongoose.Schema({
    Title: { type: String, required: true },
    Description: {type: String, required: true},
    Genre: {
        Name: String,
        Description: String
    },
    Director: {
        Name: String,
        Bio: String
    },
    ImagePath: String,
    Featured: Boolean
});

let userSchema = mongoose.Schema({
    Username: { type: String, required: true },
    Password: { type: String, required: true },
    Email: { type: String, required: true },
    Birthday: Date,
    FavoriteMovies: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Movie'}]
});

userSchema.set('toJSON', {
    transform: (document, returnedObject) => {
        delete returnedObject.Password;
        return returnedObject;
    }
});

userSchema.statics.hashPassword = (password) => {
    return bcrypt.hashSync(password, 10);
};

userSchema.methods.validatePassword = function(password) {
    return bcrypt.compareSync(password, this.Password);
};

let Movie = mongoose.model('Movie', movieSchema);
let User = mongoose.model('User', userSchema);

module.exports.Movie = Movie;
module.exports.User = User;

// ===== FILE: passport.js =====
const passport = require ('passport'),
    LocalStrategy = require ('passport-local').Strategy,
    Models = require ('./models.js'),
    passportJWT = require ('passport-jwt');
const { jwtSecret } = require('./config');

let Users = Models.User,
    JWTStrategy = passportJWT.Strategy,
    ExtractJWT = passportJWT.ExtractJwt;

passport.use(
    new LocalStrategy(
        {
            usernameField: 'Username',
            passwordField: 'Password',
        },
        async (username, password, callback) => {
            try {
                const user = await Users.findOne({ Username: username });
                if (!user) {
                    return callback(null, false, { message: 'Incorrect username or password.' });
                }
                if (!user.validatePassword(password)) {
                    return callback(null, false, { message: 'Incorrect password.' });
                }
                return callback(null, user);
            } catch (error) {
                return callback(error);
            }
        }
    )
);

passport.use(new JWTStrategy({
    jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
    secretOrKey: jwtSecret
},  async (jwtPayload, callback) => {
    try {
        const user = await Users.findById(jwtPayload._id);
        return callback(null, user);
    } catch (error) {
        return callback(error);
    }
}));

// ===== FILE: middleware/authorization.js =====
const requireSelf = (req, res, next) => {
  if (req.user.Username !== req.params.Username) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
};

module.exports = { requireSelf };

// ===== FILE: middleware/errors.js =====
const errorHandler = (err, req, res, _next) => {
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
};

module.exports = { errorHandler };

// ===== FILE: middleware/resources.js =====
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

// ===== FILE: middleware/validation.js =====
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

// ===== FILE: routes/auth.js =====
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

// ===== FILE: routes/movies.js =====
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

// ===== FILE: routes/users.js =====
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
