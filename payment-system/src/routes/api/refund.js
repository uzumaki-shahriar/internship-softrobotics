const express = require("express");
const jwtAuth = require("../../middleware/jwtAuth");
const requireRole = require("../../middleware/requireRole");
const { validateBody } = require("../../middleware/validate");
const { refundSchema } = require("../../validators/refund.schema");
const { refundTransaction } = require("../../services/refundService");
const prisma = require("../../db");

const router = express.Router();

router.post("/", jwtAuth, requireRole("merchant"), validateBody(refundSchema), async (req, res, next) => {
  try {
    const merchant = await prisma.merchant.findUnique({ where: { id: req.user.merchantId } });
    const result = await refundTransaction(merchant, req.body);
    if (result.status === "declined") {
      res.locals.logLevel = "warn";
      res.locals.logMessage = `[${result.decline_reason}] declined`;
    }
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
