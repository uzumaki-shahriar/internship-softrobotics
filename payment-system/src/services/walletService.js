const crypto = require("crypto");
const prisma = require("../db");
const bankClient = require("../clients/bankClient");
const { NotFoundError, ValidationError } = require("../errors");

async function getWallets(merchantId) {
  return prisma.wallet.findMany({ where: { merchantId }, include: { currency: true } });
}

/**
 * Merchant-initiated payout: moves money OUT of the platform, from the
 * wallet's available balance to the merchant's linked bank account. This
 * is the only thing that actually calls the Bank System's payout endpoint -
 * settlement/rolling-release (settlementService.js) only ever move money
 * between wallet buckets, never call the bank.
 */
async function withdraw(merchantId, currencyCode, amount) {
  if (!(amount > 0)) throw new ValidationError("Enter an amount greater than zero.");

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new NotFoundError("Merchant not found");
  if (!merchant.bankAccountNumber) {
    throw new ValidationError("Link a bank account in Settings before withdrawing.");
  }

  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
  if (!currency) throw new ValidationError("Unsupported currency");

  const wallet = await prisma.wallet.findUnique({
    where: { merchantId_currencyId: { merchantId, currencyId: currency.id } },
  });
  if (!wallet || Number(wallet.balance) < amount) {
    throw new ValidationError("Withdrawal amount exceeds your available balance.");
  }

  const idempotencyKey = `withdraw:${wallet.id}:${crypto.randomUUID()}`;
  const result = await bankClient.payout({
    account_number: merchant.bankAccountNumber,
    amount,
    currency: currencyCode,
    idempotency_key: idempotencyKey,
    reference: idempotencyKey,
  });

  if (result.status !== "approved") {
    return { status: "declined", decline_reason: result.decline_reason };
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: amount } },
  });

  return { status: "approved", bank_reference: result.bank_reference };
}

async function listTransactions(merchantId, { page, pageSize, status }) {
  const where = status ? { merchantId, status } : { merchantId };
  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { currency: true },
    }),
    prisma.transaction.count({ where }),
  ]);
  return { items, total, page, page_size: pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

async function getTransactionDetail(merchantId, invoiceId) {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceId },
    include: { currency: true, refunds: { orderBy: { createdAt: "desc" } } },
  });
  if (!transaction || transaction.merchantId !== merchantId) {
    // Same response as "doesn't exist" - never confirm another merchant's
    // invoice_id exists, same rule as the API's verify endpoint.
    throw new NotFoundError("Transaction not found");
  }
  return transaction;
}

module.exports = { getWallets, listTransactions, getTransactionDetail, withdraw };
