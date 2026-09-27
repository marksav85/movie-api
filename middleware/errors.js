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
