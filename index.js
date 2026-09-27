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
