const prisma = require("../db");
const { hashApiKey } = require("../utils/generators");
const { UnauthorizedError, ForbiddenError } = require("../errors");

// Authenticates a merchant's own server calling the Gateway
// server-to-server (checkout/init, verify, refund, ...). Distinct from
// jwtAuth, which is for a human logged into the merchant/admin dashboard.
async function apiKeyAuth(req, res, next) {
  const key = req.header("X-API-KEY");
  if (!key) {
    return next(new UnauthorizedError("Missing X-API-KEY"));
  }

  const merchant = await prisma.merchant.findUnique({ where: { apiKeyHash: hashApiKey(key) } });
  if (!merchant) {
    return next(new UnauthorizedError("Invalid X-API-KEY"));
  }
  if (merchant.status !== "active") {
    return next(new ForbiddenError(`Merchant is ${merchant.status}, not active`));
  }

  req.merchant = merchant;
  next();
}

module.exports = apiKeyAuth;
