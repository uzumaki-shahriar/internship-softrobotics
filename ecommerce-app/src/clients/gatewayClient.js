const config = require("../config");
const prisma = require("../db");

const TIMEOUT_MS = 10_000;

async function getApiKey() {
  const shopConfig = await prisma.shopConfig.findFirst({ orderBy: { id: "desc" } });
  if (!shopConfig) {
    throw new Error("Shop is not yet registered with the Payment Gateway - bootstrap must run first");
  }
  return shopConfig.merchantApiKey;
}

/**
 * Creates a checkout session on the real Payment Gateway. Never touches
 * card data - this shop only ever sees an amount and gets back a URL to
 * redirect the customer to.
 */
async function initCheckout({ order_id, amount, currency, success_url, fail_url }) {
  const apiKey = await getApiKey();
  const res = await fetch(`${config.gatewayBaseUrl}/api/checkout/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify({ order_id, amount, currency, success_url, fail_url }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const body = await res.json();
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
  const apiKey = await getApiKey();
  const res = await fetch(`${config.gatewayBaseUrl}/api/transactions/${invoiceId}/verify`, {
    headers: { "X-API-KEY": apiKey },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Gateway verify failed: ${res.status}`);
  }
  return res.json();
}

module.exports = { initCheckout, verifyTransaction };
