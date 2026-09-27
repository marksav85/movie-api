const requireSelf = (req, res, next) => {
  if (req.user.Username !== req.params.Username) {
    return res.status(403).json({ message: "Forbidden" });
  }

  return next();
};

module.exports = { requireSelf };
