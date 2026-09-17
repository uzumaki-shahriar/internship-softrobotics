require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  appName: process.env.APP_NAME || "Payment Gateway",
  port: parseInt(process.env.PORT || "8000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",

  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  sessionSecret: required("SESSION_SECRET"),

  // The Bank System this Gateway talks to, server-to-server.
  bankApiBaseUrl: process.env.BANK_API_BASE_URL || "http://localhost:8001",
  bankApiKey: required("BANK_API_KEY"),

  // The Bank's OTP challenge page is customer-facing - the customer's
  // browser is redirected there directly, so this must be an address that
  // browser can actually reach. Deliberately separate from bankApiBaseUrl,
  // which is only ever called server-to-server and may be an internal
  // Docker hostname a browser could never resolve.
  bankPublicBaseUrl: process.env.BANK_PUBLIC_BASE_URL || "http://localhost:8001",

  checkoutSessionTtlMinutes: parseInt(process.env.CHECKOUT_SESSION_TTL_MINUTES || "5", 10),

  // Card-testing-fraud guard: a real checkout (Stripe, SSLCommerz) locks a
  // session after this many declines rather than letting it be hammered
  // with stolen card numbers indefinitely. Same session, different card,
  // up to this many tries.
  maxPaymentAttempts: parseInt(process.env.MAX_PAYMENT_ATTEMPTS || "3", 10),

  // The Gateway's own customer-facing address, used to build checkout_url.
  // Deliberately NOT derived from the incoming request's Host header - the
  // caller here is a merchant's *server* (checkout/init is server-to-
  // server), which may reach this API via an internal hostname a
  // customer's browser could never resolve (e.g. Docker's internal DNS).
  // A real gateway's hosted checkout always lives on its own fixed public
  // domain, independent of who called the API.
  publicBaseUrl: process.env.PUBLIC_BASE_URL || "http://localhost:8000",

  // Shows one-click "fill this card" buttons on the checkout page, sourced
  // live from the Bank System's currently-seeded test cards. This whole
  // project is sandbox-only (every key is sk_test_...), so on by default;
  // set to "false" to see the checkout page as a real customer would.
  showTestCardHelper: process.env.SHOW_TEST_CARD_HELPER !== "false",
};
