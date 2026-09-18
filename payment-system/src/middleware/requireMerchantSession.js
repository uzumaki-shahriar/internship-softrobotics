function requireMerchantSession(req, res, next) {
  if (!req.session.merchantId) {
    return res.redirect("/login");
  }
  next();
}

module.exports = requireMerchantSession;
