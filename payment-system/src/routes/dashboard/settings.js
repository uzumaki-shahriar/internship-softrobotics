const express = require("express");
const { getMerchantProfile, regenerateApiKey, setBankAccount } = require("../../services/merchantService");

const router = express.Router();

router.get("/settings", async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile(req.session.merchantId);
    res.render("merchant/settings", { merchant, newApiKey: null, bankAccountError: null });
  } catch (err) {
    next(err);
  }
});

router.post("/settings/bank-account", async (req, res, next) => {
  try {
    await setBankAccount(req.session.merchantId, req.body.account_number);
    req.flash("success", "Bank account linked.");
    res.redirect("/dashboard/settings");
  } catch (err) {
    if (err.statusCode === 422) {
      const merchant = await getMerchantProfile(req.session.merchantId);
      return res.status(422).render("merchant/settings", {
        merchant,
        newApiKey: null,
        bankAccountError: err.message,
      });
    }
    next(err);
  }
});

// Renders the full key directly on the response (not via a redirect/flash) -
// it's a secret, shown exactly once, so it shouldn't round-trip through
// session-backed flash storage or a URL.
router.post("/settings/api-key/regenerate", async (req, res, next) => {
  try {
    const { fullApiKey } = await regenerateApiKey(req.session.merchantId);
    const merchant = await getMerchantProfile(req.session.merchantId);
    res.render("merchant/settings", { merchant, newApiKey: fullApiKey, bankAccountError: null });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
