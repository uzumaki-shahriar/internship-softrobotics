const express = require("express");
const jwtAuth = require("../../middleware/jwtAuth");
const requireRole = require("../../middleware/requireRole");
const { getWallets } = require("../../services/walletService");

const router = express.Router();

router.get("/", jwtAuth, requireRole("merchant"), async (req, res, next) => {
  try {
    const wallets = await getWallets(req.user.merchantId);
    res.json(wallets.map((w) => ({ currency: w.currency.code, balance: w.balance })));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
