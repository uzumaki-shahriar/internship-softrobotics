const prisma = require("../db");
const config = require("../config");
const bankClient = require("../clients/bankClient");
const { generateInvoiceId } = require("../utils/generators");
const { calculateFee } = require("../utils/fee");
const { NotFoundError, ValidationError } = require("../errors");

async function initCheckout(merchant, { order_id, amount, currency, success_url, fail_url }) {
  const currencyRow = await prisma.currency.findUnique({ where: { code: currency } });
  if (!currencyRow) throw new ValidationError(`Currency ${currency} is not supported`);

  // A merchant can only accept a currency they have a commission deal for -
  // otherwise there's no rate to charge fees at when the sale completes.
  const pricingPlan = await prisma.pricingPlan.findUnique({
    where: { merchantId_currencyId: { merchantId: merchant.id, currencyId: currencyRow.id } },
  });
  if (!pricingPlan || !pricingPlan.status) {
    throw new ValidationError(`Merchant is not approved to accept ${currency}`);
  }

  const expiresAt = new Date(Date.now() + config.checkoutSessionTtlMinutes * 60 * 1000);

  const transaction = await prisma.transaction.create({
    data: {
      invoiceId: generateInvoiceId(),
      orderId: order_id,
      merchantId: merchant.id,
      currencyId: currencyRow.id,
      pricingPlanId: pricingPlan.id,
      status: "pending",
      grossAmount: amount,
      successUrl: success_url,
      failUrl: fail_url,
      expiresAt,
    },
  });

  return transaction;
}

const TRANSACTION_INCLUDE = { currency: true, merchant: true, pricingPlan: true };

async function findTransaction(invoiceId) {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceId },
    include: TRANSACTION_INCLUDE,
  });
  if (!transaction) throw new NotFoundError("Checkout session not found");
  return transaction;
}

/**
 * If a session is still marked pending but its expiry has passed, flips it
 * to expired right now. Called independently at both the point the card
 * form is rendered and the point it's submitted, since a customer can load
 * the page before expiry and submit after - checked lazily, no background
 * job needed for a TTL this short.
 */
async function expireIfNeeded(transaction) {
  if (transaction.status === "pending" && transaction.expiresAt.getTime() <= Date.now()) {
    return prisma.transaction.update({
      where: { id: transaction.id },
      include: TRANSACTION_INCLUDE,
      data: { status: "expired", declineReason: "SESSION_EXPIRED" },
    });
  }
  return transaction;
}

function failUrlWithReason(transaction, reason) {
  const url = new URL(transaction.failUrl);
  url.searchParams.set("invoice_id", transaction.invoiceId);
  url.searchParams.set("reason", reason);
  return url.toString();
}

function successUrlFor(transaction) {
  const url = new URL(transaction.successUrl);
  url.searchParams.set("invoice_id", transaction.invoiceId);
  return url.toString();
}

/**
 * Processes a payment attempt against a checkout session. Never trusts an
 * amount/currency from the request - always the session's own stored
 * values, so a customer can't tamper with the price in their browser.
 */
async function payForSession(invoiceId, cardDetails) {
  let transaction = await findTransaction(invoiceId);

  // Already resolved one way or another - don't re-charge, just report
  // where it landed (handles a double form-submit safely).
  if (transaction.status === "completed") {
    return { redirectUrl: successUrlFor(transaction), status: "completed" };
  }
  if (transaction.status === "failed" || transaction.status === "expired") {
    const reason = transaction.declineReason || "FAILED";
    return { redirectUrl: failUrlWithReason(transaction, reason), status: transaction.status, declineReason: reason };
  }

  transaction = await expireIfNeeded(transaction);
  if (transaction.status === "expired") {
    return {
      redirectUrl: failUrlWithReason(transaction, "SESSION_EXPIRED"),
      status: "expired",
      declineReason: "SESSION_EXPIRED",
    };
  }

  const bankResult = await bankClient.charge({
    card_number: cardDetails.card_number,
    card_holder_name: cardDetails.card_holder_name,
    expiry_month: cardDetails.expiry_month,
    expiry_year: cardDetails.expiry_year,
    cvv: cardDetails.cvv,
    amount: Number(transaction.grossAmount),
    currency: transaction.currency.code,
    idempotency_key: transaction.invoiceId,
    reference: transaction.invoiceId,
  });

  if (bankResult.status === "approved") {
    const { fee, net } = calculateFee(Number(transaction.grossAmount), transaction.pricingPlan);

    [transaction] = await prisma.$transaction([
      prisma.transaction.update({
        where: { id: transaction.id },
        include: TRANSACTION_INCLUDE,
        data: {
          status: "completed",
          bankReference: bankResult.bank_reference,
          feeAmount: fee,
          netAmount: net,
        },
      }),
      prisma.wallet.upsert({
        where: { merchantId_currencyId: { merchantId: transaction.merchantId, currencyId: transaction.currencyId } },
        update: { balance: { increment: net } },
        create: { merchantId: transaction.merchantId, currencyId: transaction.currencyId, balance: net },
      }),
    ]);
    return { redirectUrl: successUrlFor(transaction), status: "completed" };
  }

  transaction = await prisma.transaction.update({
    where: { id: transaction.id },
    include: TRANSACTION_INCLUDE,
    data: { status: "failed", declineReason: bankResult.decline_reason },
  });
  return {
    redirectUrl: failUrlWithReason(transaction, bankResult.decline_reason),
    status: "failed",
    declineReason: bankResult.decline_reason,
  };
}

module.exports = { initCheckout, findTransaction, expireIfNeeded, payForSession };
