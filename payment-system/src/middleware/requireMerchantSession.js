function requireMerchantSession(req, res, next) {
  if (!req.session.merchantId) {
    return res.redirect("/dashboard/login");
  }
  next();
}

module.exports = requireMerchantSession;
