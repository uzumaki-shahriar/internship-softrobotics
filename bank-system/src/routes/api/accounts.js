const express = require("express");
const prisma = require("../../db");
const { NotFoundError } = require("../../errors");

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

module.exports = router;
