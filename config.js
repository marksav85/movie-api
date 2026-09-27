const exampleJwtSecret = "replace-with-a-long-random-secret";
const jwtSecret = process.env.JWT_SECRET;

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

module.exports = { jwtSecret };
