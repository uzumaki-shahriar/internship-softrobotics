const config = require("../config");

const TIMEOUT_MS = 10_000;

/**
 * Calls the real Bank System server-to-server. Network failures/timeouts
 * are caught here and turned into a GATEWAY_ERROR decline rather than an
 * unhandled exception mid-checkout - the customer still gets a clean
 * fail page, and the merchant can see GATEWAY_ERROR in verify/transactions
 * rather than the checkout just hanging or 500ing.
 */
async function callBank(path, payload) {
  try {
    const res = await fetch(`${config.bankApiBaseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": config.bankApiKey },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      return { status: "declined", decline_reason: "GATEWAY_ERROR" };
    }
    return res.json();
  } catch {
    return { status: "declined", decline_reason: "GATEWAY_ERROR" };
  }
}

function charge(payload) {
  return callBank("/api/cards/charge", payload);
}

function refund(payload) {
  return callBank("/api/cards/refund", payload);
}

/**
 * Deposits settlement/rolling money into a merchant's payout account at
 * the Bank System - no card involved, not tied to a prior charge. See
 * bank-system's src/services/payoutService.js for the receiving side.
 */
function payout(payload) {
  return callBank("/api/accounts/payout", payload);
}

/**
 * Pulls money OUT of a merchant's linked bank account into their PSP
 * wallet - the opposite of payout. See bank-system's
 * src/services/debitService.js for the debiting side (checks balance,
 * account status, daily limit; declines with INSUFFICIENT_FUNDS etc.).
 */
function debit(payload) {
  return callBank("/api/accounts/debit", payload);
}

/**
 * Confirms a charge's real outcome server-to-server when the customer's
 * browser bounces back from the Bank's OTP page - never trusts that
 * redirect alone. Same failure handling as callBank: unreachable/timeout
 * becomes a clean GATEWAY_ERROR decline rather than a hang or crash.
 */
async function getChargeStatus(idempotencyKey) {
  try {
    const res = await fetch(`${config.bankApiBaseUrl}/api/cards/status/${encodeURIComponent(idempotencyKey)}`, {
      headers: { "X-API-KEY": config.bankApiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return { status: "declined", decline_reason: "GATEWAY_ERROR" };
    }
    return res.json();
  } catch {
    return { status: "declined", decline_reason: "GATEWAY_ERROR" };
  }
}

/**
 * Confirms an account number really exists at the Bank System before a
 * merchant links it for payouts - returns null if not found or unreachable
 * rather than throwing, since this is a validation check, not a payment.
 */
async function getAccountBalance(accountNumber) {
  try {
    const res = await fetch(`${config.bankApiBaseUrl}/api/accounts/${encodeURIComponent(accountNumber)}/balance`, {
      headers: { "X-API-KEY": config.bankApiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// Testing convenience only - lets the checkout page show one-click "fill
// this card" buttons for whatever the Bank System currently has seeded,
// instead of hardcoding numbers that change on every reseed. Never fails
// the checkout page if the Bank is unreachable - the form still works,
// it just won't have the shortcut buttons.
async function getTestCards() {
  try {
    const res = await fetch(`${config.bankApiBaseUrl}/api/test-cards`, {
      headers: { "X-API-KEY": config.bankApiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

module.exports = { charge, refund, payout, debit, getChargeStatus, getAccountBalance, getTestCards };
