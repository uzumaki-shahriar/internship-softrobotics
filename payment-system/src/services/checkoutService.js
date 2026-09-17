const prisma = require("../db");
const config = require("../config");
const bankClient = require("../clients/bankClient");
const { generateInvoiceId, generateAttemptToken } = require("../utils/generators");
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
 * Mints a fresh attempt token and saves it as the session's current one.
 * Called every time the pay form is (re)rendered - initial GET, and after
 * a non-fatal decline that still has retries left. The token becomes part
 * of that attempt's Bank System idempotency key (see payForSession): a
 * raw double-submit of the same rendered page reuses the same token (the
 * bank correctly dedupes it and returns the same result), while a fresh
 * page render - i.e. an intentional retry with a different card - gets a
 * new token (the bank correctly treats it as a new charge to evaluate).
 */
async function prepareAttempt(transaction) {
  const currentAttemptToken = generateAttemptToken();
  return prisma.transaction.update({
    where: { id: transaction.id },
    include: TRANSACTION_INCLUDE,
    data: { currentAttemptToken },
  });
}

/**
 * Customer-initiated abandonment - same real-world action as closing
 * Stripe Checkout or hitting "back" on SSLCommerz. Only a still-pending
 * session can be cancelled; anything already resolved is left untouched.
 */
async function cancelSession(invoiceId) {
  let transaction = await findTransaction(invoiceId);
  transaction = await expireIfNeeded(transaction);
  if (transaction.status !== "pending") {
    return { redirectUrl: failUrlWithReason(transaction, transaction.declineReason || "FAILED"), status: transaction.status };
  }

  transaction = await prisma.transaction.update({
    where: { id: transaction.id },
    include: TRANSACTION_INCLUDE,
    data: { status: "failed", declineReason: "CANCELLED" },
  });
  return { redirectUrl: failUrlWithReason(transaction, "CANCELLED"), status: "failed", declineReason: "CANCELLED" };
}

/**
 * Already resolved one way or another - don't re-charge, just report
 * where it landed (handles a double form-submit, or a stale callback,
 * safely). Returns null when the session is still open for business.
 */
function alreadyResolvedResult(transaction) {
  if (transaction.status === "completed") {
    return { terminal: true, redirectUrl: successUrlFor(transaction), status: "completed" };
  }
  if (transaction.status === "failed" || transaction.status === "expired") {
    const reason = transaction.declineReason || "FAILED";
    return { terminal: true, redirectUrl: failUrlWithReason(transaction, reason), status: transaction.status, declineReason: reason };
  }
  return null;
}

/**
 * Turns a Bank System response (approved / declined / otp_required) into
 * this session's next step. Shared by payForSession (the initial charge
 * call) and resolveOtpCallback (the bounce-back from the Bank's OTP page)
 * since either one can land here.
 */
async function applyBankResult(transaction, bankResult) {
  if (bankResult.status === "otp_required") {
    // Not resolved yet - send the customer's browser to the Bank's own
    // challenge page instead of rendering anything ourselves (see
    // CLAUDE.md: only the Bank ever touches OTP/card data).
    return {
      terminal: false,
      externalRedirect: true,
      redirectUrl: `${config.bankPublicBaseUrl}/otp/${bankResult.otp_reference}`,
    };
  }

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
    return { terminal: true, redirectUrl: successUrlFor(transaction), status: "completed" };
  }

  // Declined - whether from a card-level check or from a failed/expired
  // OTP challenge, both land here the same way.
  const attemptCount = transaction.attemptCount + 1;
  const attemptsExhausted = attemptCount >= config.maxPaymentAttempts;

  if (attemptsExhausted) {
    transaction = await prisma.transaction.update({
      where: { id: transaction.id },
      include: TRANSACTION_INCLUDE,
      data: { status: "failed", declineReason: "TOO_MANY_ATTEMPTS", attemptCount },
    });
    return {
      terminal: true,
      redirectUrl: failUrlWithReason(transaction, "TOO_MANY_ATTEMPTS"),
      status: "failed",
      declineReason: "TOO_MANY_ATTEMPTS",
    };
  }

  transaction = await prisma.transaction.update({
    where: { id: transaction.id },
    include: TRANSACTION_INCLUDE,
    data: { declineReason: bankResult.decline_reason, attemptCount },
  });
  transaction = await prepareAttempt(transaction);
  return {
    terminal: false,
    transaction,
    status: "pending",
    declineReason: bankResult.decline_reason,
    attemptsRemaining: config.maxPaymentAttempts - attemptCount,
  };
}

/**
 * Processes a payment attempt against a checkout session. Never trusts an
 * amount/currency from the request - always the session's own stored
 * values, so a customer can't tamper with the price in their browser.
 *
 * A decline doesn't automatically end the session: real hosted checkouts
 * (Stripe, SSLCommerz) let the customer retry with a different card on the
 * SAME session, up to a capped number of attempts (config.maxPaymentAttempts)
 * to blunt card-testing fraud. Only exhausting that cap - or an approval -
 * is terminal; everything else re-renders the same pay page.
 */
async function payForSession(invoiceId, cardDetails, submittedToken) {
  let transaction = await findTransaction(invoiceId);

  const already = alreadyResolvedResult(transaction);
  if (already) return already;

  transaction = await expireIfNeeded(transaction);
  if (transaction.status === "expired") {
    return {
      terminal: true,
      redirectUrl: failUrlWithReason(transaction, "SESSION_EXPIRED"),
      status: "expired",
      declineReason: "SESSION_EXPIRED",
    };
  }

  // A stale/mismatched token means this submit doesn't belong to the
  // currently-rendered form (e.g. browser back button to an old page after
  // a retry already happened) - reject client-side, no bank call needed.
  if (!transaction.currentAttemptToken || submittedToken !== transaction.currentAttemptToken) {
    transaction = await prepareAttempt(transaction);
    return {
      terminal: false,
      transaction,
      status: "pending",
      declineReason: null,
      formError: "This payment form has expired, please try again",
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
    // Scoped per-attempt (not just per-invoice) so an intentional retry with
    // a new card is evaluated fresh instead of being deduped against the
    // previous, different, decline.
    idempotency_key: `${transaction.invoiceId}:${submittedToken}`,
    reference: transaction.invoiceId,
    // Where the Bank should send the customer's browser back to if it
    // needs to run them through an OTP challenge - see otp-callback route.
    return_url: `${config.publicBaseUrl}/checkout/${transaction.invoiceId}/otp-callback`,
  });

  return applyBankResult(transaction, bankResult);
}

/**
 * Called when the customer's browser bounces back from the Bank's OTP
 * page. Never trusts that redirect by itself (same rule the ecommerce
 * app's /success and /fail routes already follow) - re-derives the exact
 * idempotency key used for the original charge and asks the Bank for the
 * real, current outcome server-to-server instead.
 */
async function resolveOtpCallback(invoiceId) {
  let transaction = await findTransaction(invoiceId);

  const already = alreadyResolvedResult(transaction);
  if (already) return already;

  transaction = await expireIfNeeded(transaction);
  if (transaction.status === "expired") {
    return {
      terminal: true,
      redirectUrl: failUrlWithReason(transaction, "SESSION_EXPIRED"),
      status: "expired",
      declineReason: "SESSION_EXPIRED",
    };
  }

  if (!transaction.currentAttemptToken) {
    // No payment attempt was ever in flight for this session - nothing to
    // resolve (e.g. someone hit this URL directly). Send them back to pay.
    transaction = await prepareAttempt(transaction);
    return {
      terminal: false,
      transaction,
      status: "pending",
      declineReason: null,
      formError: "Nothing to verify - please try paying again",
    };
  }

  const idempotencyKey = `${transaction.invoiceId}:${transaction.currentAttemptToken}`;
  const bankResult = await bankClient.getChargeStatus(idempotencyKey);

  return applyBankResult(transaction, bankResult);
}

module.exports = {
  initCheckout,
  findTransaction,
  expireIfNeeded,
  prepareAttempt,
  cancelSession,
  payForSession,
  resolveOtpCallback,
};
