const { verifyToken } = require("../utils/jwt");
const { UnauthorizedError } = require("../errors");

// Verifies a Bearer JWT and attaches { id, role, merchantId? } as req.user.
// Used for merchant/admin *dashboard* actions (login-based). Server-to-
// server calls from a merchant's own backend use apiKeyAuth instead.
function jwtAuth(req, res, next) {
  const header = req.header("Authorization") || "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    return next(new UnauthorizedError("Missing or malformed Authorization header"));
  }

  try {
    req.user = verifyToken(token);
    next();
  } catch {
    next(new UnauthorizedError("Invalid or expired token"));
  }
}

module.exports = jwtAuth;
