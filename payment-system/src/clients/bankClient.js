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

module.exports = { charge, refund };
