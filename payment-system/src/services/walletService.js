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
    return { status: "declined", decline_reason: result.decline_reason, message: describeDecline(result.decline_reason) };
  }

  await prisma.wallet.update({
    where: { id: wallet.id },
    data: { balance: { decrement: amount } },
  });

  return { status: "approved", bank_reference: result.bank_reference };
}

// Human-readable decline reasons for deposit/withdraw failures, shown
// directly to the merchant instead of a raw enum code.
const DECLINE_MESSAGES = {
  INSUFFICIENT_FUNDS: "Insufficient balance in your linked bank account.",
  LIMIT_EXCEEDED: "This exceeds your bank account's daily transaction limit.",
  ACCOUNT_FROZEN: "Your linked bank account is frozen.",
  ACCOUNT_CLOSED: "Your linked bank account is closed.",
  ACCOUNT_NOT_FOUND: "Your linked bank account could not be found.",
  CURRENCY_NOT_SUPPORTED: "This currency isn't supported by your bank account.",
  GATEWAY_ERROR: "The bank is temporarily unreachable - try again shortly.",
};

function describeDecline(reason) {
  return DECLINE_MESSAGES[reason] || `Declined: ${reason}`;
}

/**
 * Merchant-initiated deposit: pulls money FROM the merchant's linked bank
 * account INTO their PSP wallet's available balance - the opposite of
 * withdraw. The only thing that calls the Bank System's debit endpoint.
 */
async function deposit(merchantId, currencyCode, amount) {
  if (!(amount > 0)) throw new ValidationError("Enter an amount greater than zero.");

  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) throw new NotFoundError("Merchant not found");
  if (!merchant.bankAccountNumber) {
    throw new ValidationError("Link a bank account in Settings before depositing.");
  }

  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } });
  if (!currency) throw new ValidationError("Unsupported currency");

  const idempotencyKey = `deposit:${merchantId}:${currency.id}:${crypto.randomUUID()}`;
  const result = await bankClient.debit({
    account_number: merchant.bankAccountNumber,
    amount,
    currency: currencyCode,
    idempotency_key: idempotencyKey,
    reference: idempotencyKey,
  });

  if (result.status !== "approved") {
    return { status: "declined", decline_reason: result.decline_reason, message: describeDecline(result.decline_reason) };
  }

  await prisma.wallet.upsert({
    where: { merchantId_currencyId: { merchantId, currencyId: currency.id } },
    update: { balance: { increment: amount } },
    create: { merchantId, currencyId: currency.id, balance: amount },
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

module.exports = { getWallets, listTransactions, getTransactionDetail, withdraw, deposit };
