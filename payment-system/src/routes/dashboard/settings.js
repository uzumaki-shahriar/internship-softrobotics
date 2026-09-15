const express = require("express");
const { getMerchantProfile, regenerateApiKey } = require("../../services/merchantService");

const router = express.Router();

router.get("/settings", async (req, res, next) => {
  try {
    const merchant = await getMerchantProfile(req.session.merchantId);
    res.render("merchant/settings", { merchant, newApiKey: null });
  } catch (err) {
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
    res.render("merchant/settings", { merchant, newApiKey: fullApiKey });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
