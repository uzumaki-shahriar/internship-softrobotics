const express = require("express");
const prisma = require("../../db");
const { NotFoundError } = require("../../errors");
const { payoutSchema } = require("../../validators/payout.schema");
const { validateBody } = require("../../middleware/validate");
const { payoutToAccount } = require("../../services/payoutService");

const router = express.Router();

router.get("/:accountNumber/balance", async (req, res, next) => {
  try {
    const account = await prisma.account.findUnique({
      where: { accountNumber: req.params.accountNumber },
    });
    if (!account) throw new NotFoundError("Account not found");
    res.json({
      account_number: account.accountNumber,
      balance: account.balance.toNumber(),
      status: account.status,
    });
  } catch (err) {
    next(err);
  }
});

// Deposits settlement money into an account (e.g. a merchant's payout
// account) - no card involved, not tied to a prior charge. See
// services/payoutService.js.
router.post("/payout", validateBody(payoutSchema), async (req, res, next) => {
  try {
    const result = await payoutToAccount(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
