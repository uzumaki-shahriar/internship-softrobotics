const crypto = require("crypto");

function randomDigits(length) {
  let out = "";
  for (let i = 0; i < length; i++) out += crypto.randomInt(0, 10);
  return out;
}

function generateStoreId() {
  return "STORE" + randomDigits(6);
}

// sk_test_ prefix mirrors Stripe's convention - immediately recognizable as
// a Gateway secret key in logs, error messages, etc. "test" since this
// project only ever simulates a sandbox, never a real "live" mode.
function generateApiKey() {
  const random = crypto.randomBytes(24).toString("base64url");
  return `sk_test_${random}`;
}

function apiKeyPrefix(fullKey) {
  return fullKey.slice(0, 16); // "sk_test_" + first 8 chars of the random part
}

// API keys are 192 bits of randomness already, unlike a human password -
// a fast deterministic hash (not bcrypt) is correct here: it allows O(1)
// lookup by hashing the incoming header and querying by equality, and
// brute-forcing is infeasible regardless of hash speed at this entropy.
function hashApiKey(fullKey) {
  return crypto.createHash("sha256").update(fullKey).digest("hex");
}

function generateInvoiceId() {
  return "inv_" + crypto.randomBytes(18).toString("base64url");
}

// One of these is minted every time the pay form is (re)rendered and becomes
// part of that attempt's Bank System idempotency key - see checkoutService.js.
function generateAttemptToken() {
  return crypto.randomBytes(16).toString("base64url");
}

// For admin-created merchants - never chosen by the admin, shown to them
// exactly once so they can hand it to the merchant out of band.
function generateTemporaryPassword() {
  return crypto.randomBytes(9).toString("base64url");
}

module.exports = {
  generateStoreId,
  generateApiKey,
  apiKeyPrefix,
  hashApiKey,
  generateInvoiceId,
  generateTemporaryPassword,
  generateAttemptToken,
};
