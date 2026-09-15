const config = require("../config");
const { MerchantNotApprovedError } = require("../errors");

const TIMEOUT_MS = 10_000;

/**
 * Creates a checkout session on the real Payment Gateway. Never touches
 * card data - this shop only ever sees an amount and gets back a URL to
 * redirect the customer to.
 */
async function initCheckout({ order_id, amount, currency, success_url, fail_url }) {
  const res = await fetch(`${config.gatewayBaseUrl}/api/checkout/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": config.gatewayApiKey },
    body: JSON.stringify({ order_id, amount, currency, success_url, fail_url }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json();
  if (res.status === 403) {
    // The Gateway's apiKeyAuth rejects any non-"active" merchant with 403 -
    // this store registered fine but a human hasn't approved it in the
    // Gateway's admin panel yet. Distinguished from other failures so the
    // shop can show a clear "we're not ready to take payments yet" page
    // instead of a generic error.
    throw new MerchantNotApprovedError();
  }
  if (!res.ok) {
    throw new Error(`Gateway checkout/init failed: ${body?.error?.message || res.status}`);
  }
  return body;
}

/**
 * Confirms what actually happened server-side. This is the call that
 * matters - the redirect back from the Gateway is never trusted alone,
 * since a customer could hit /success manually without ever paying.
 */
async function verifyTransaction(invoiceId) {
  const res = await fetch(`${config.gatewayBaseUrl}/api/transactions/${invoiceId}/verify`, {
    headers: { "X-API-KEY": config.gatewayApiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Gateway verify failed: ${res.status}`);
  }
  return res.json();
}

module.exports = { initCheckout, verifyTransaction };
