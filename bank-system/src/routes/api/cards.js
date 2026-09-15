const express = require("express");
const { chargeSchema } = require("../../validators/charge.schema");
const { refundSchema } = require("../../validators/refund.schema");
const { validateBody } = require("../../middleware/validate");
const { chargeCard } = require("../../services/chargeService");
const { refundCard } = require("../../services/refundService");
const { annotateOutcome } = require("../../utils/logOutcome");

const router = express.Router();

router.post("/charge", validateBody(chargeSchema), async (req, res, next) => {
  try {
    const result = await chargeCard(req.body);
    annotateOutcome(res, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post("/refund", validateBody(refundSchema), async (req, res, next) => {
  try {
    const result = await refundCard(req.body);
    annotateOutcome(res, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
