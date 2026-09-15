const express = require("express");
const apiKeyAuth = require("../../middleware/apiKeyAuth");
const { validateBody } = require("../../middleware/validate");
const { initSchema } = require("../../validators/checkout.schema");
const { initCheckout } = require("../../services/checkoutService");
const config = require("../../config");

const router = express.Router();

router.post("/init", apiKeyAuth, validateBody(initSchema), async (req, res, next) => {
  try {
    const transaction = await initCheckout(req.merchant, req.body);
    const checkoutUrl = `${config.publicBaseUrl}/checkout/${transaction.invoiceId}`;
    res.status(201).json({
      invoice_id: transaction.invoiceId,
      checkout_url: checkoutUrl,
      expires_at: transaction.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
