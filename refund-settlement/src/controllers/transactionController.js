const prisma = require("../lib/prisma");

// GET /transactions
async function list(req, res) {
  const transactions = await prisma.transaction.findMany({
    include: { merchant: true, currency: true },
    orderBy: { id: "desc" },
  });
  res.render("transactions/index", { transactions });
}

// GET /transactions/new
async function showNewForm(req, res) {
  const merchants = await prisma.merchant.findMany();
  const currencies = await prisma.currency.findMany();
  const posList = await prisma.pos.findMany();
  const selectedMerchantId = req.query.merchant_id
    ? Number(req.query.merchant_id)
    : null;
  res.render("transactions/new", {
    merchants,
    currencies,
    posList,
    selectedMerchantId,
  });
}

// POST /transactions
async function create(req, res) {
  const { merchant_id, order_id, invoice_id, amount, currency_id, pos_id } =
    req.body;

  const gross = Number(amount);
  const fee = Number((gross * 0.02).toFixed(2)); // simple flat 2% fee for demo
  const net = Number((gross - fee).toFixed(2));

  await prisma.transaction.create({
    data: {
      merchantId: Number(merchant_id),
      orderId: order_id,
      invoiceId: invoice_id,
      currencyId: Number(currency_id),
      posId: Number(pos_id),
      gross,
      fee,
      net,
      transactionState: "Pending",
    },
  });

  res.redirect("/transactions");
}

// GET /transactions/:id
async function show(req, res) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: Number(req.params.id) },
    include: { merchant: true, currency: true, refunds: true },
  });

  if (!transaction) return res.status(404).send("Transaction not found");

  res.render("transactions/show", { transaction });
}

// POST /transactions/:id/refund
// Refunds are direct: no pending/approval step. The amount is deducted from
// the wallet immediately (blocked balance first, then available, then the
// rolling reserve) and the transaction state is updated in the same step.
async function refund(req, res) {
  const transactionId = Number(req.params.id);
  const amount = Number(req.body.amount);

  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });

  if (!transaction) return res.status(404).send("Transaction not found");

  if (!["Completed", "PartialRefunded"].includes(transaction.transactionState)) {
    return res.status(400).send("Transaction is not refundable");
  }

  const refundable =
    Number(transaction.gross) - Number(transaction.refundedAmount);

  if (amount <= 0 || amount > refundable) {
    return res.status(400).send("Invalid refund amount");
  }

  await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({
      where: {
        merchantId_currencyId: {
          merchantId: transaction.merchantId,
          currencyId: transaction.currencyId,
        },
      },
    });

    if (!wallet) throw new Error("Wallet not found for transaction");

    let remaining = amount;
    let blockedBalance = Number(wallet.blockedBalance);
    let availableBalance = Number(wallet.availableBalance);
    let rollingBalance = Number(wallet.rollingBalance);

    const fromBlocked = Math.min(remaining, blockedBalance);
    blockedBalance -= fromBlocked;
    remaining -= fromBlocked;

    const fromAvailable = Math.min(remaining, availableBalance);
    availableBalance -= fromAvailable;
    remaining -= fromAvailable;

    const fromRolling = Math.min(remaining, rollingBalance);
    rollingBalance -= fromRolling;
    remaining -= fromRolling;

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        totalBalance: { decrement: amount - remaining },
        blockedBalance,
        availableBalance,
        rollingBalance,
      },
    });

    const newRefundedAmount = Number(transaction.refundedAmount) + amount;
    const newState =
      newRefundedAmount >= Number(transaction.gross)
        ? "Refunded"
        : "PartialRefunded";

    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        refundedAmount: newRefundedAmount,
        transactionState: newState,
      },
    });

    await tx.refund.create({
      data: {
        transactionId,
        amount,
        status: "Completed",
        completedAt: new Date(),
      },
    });
  });

  res.redirect(`/transactions/${transactionId}`);
}

module.exports = { list, showNewForm, create, show, refund };
