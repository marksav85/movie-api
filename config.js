const exampleJwtSecret = "replace-with-a-long-random-secret";
const jwtSecret = process.env.JWT_SECRET;
const nodeEnv = process.env.NODE_ENV || "development";
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
};
