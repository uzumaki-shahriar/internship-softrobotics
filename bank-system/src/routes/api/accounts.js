const express = require("express");
const prisma = require("../../db");
const { NotFoundError } = require("../../errors");
const { payoutSchema } = require("../../validators/payout.schema");
const { debitSchema } = require("../../validators/debit.schema");
const { validateBody } = require("../../middleware/validate");
const { payoutToAccount } = require("../../services/payoutService");
const { debitAccount } = require("../../services/debitService");
const { annotateOutcome } = require("../../utils/logOutcome");

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
    annotateOutcome(res, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Pulls money out of an account with no card - the opposite of /payout.
// See services/debitService.js. Used by the Payment Gateway for merchant
// deposits (merchant's own bank account -> their PSP wallet).
router.post("/debit", validateBody(debitSchema), async (req, res, next) => {
  try {
    const result = await debitAccount(req.body);
    annotateOutcome(res, result);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
