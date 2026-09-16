const config = require("../config");
const { UnauthorizedError } = require("../errors");

function apiKeyAuth(req, res, next) {
  const key = req.header("X-API-KEY");
  if (!key || key !== config.apiKey) {
    return next(new UnauthorizedError("Invalid or missing X-API-KEY"));
  }
  next();
}

module.exports = apiKeyAuth;
