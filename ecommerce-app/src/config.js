require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  appName: process.env.APP_NAME || "Bookworm Cafe",
  port: parseInt(process.env.PORT || "3000", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",

  databaseUrl: required("DATABASE_URL"),

  // The Payment Gateway this shop is a merchant of.
  gatewayBaseUrl: process.env.GATEWAY_BASE_URL || "http://localhost:8000",
  gatewayCurrency: process.env.GATEWAY_CURRENCY || "BDT",

  // This shop's own merchant credential with the Payment Gateway. There is
  // deliberately no code anywhere in this app that registers itself or logs
  // into the Gateway on the shop's behalf - the 3 systems are separate,
  // independently-operated businesses in this simulation, exactly like a
  // real store and Stripe/SSLCommerz. A human gets this key the same way a
  // real merchant does: register at the Gateway, wait for the Gateway's own
  // admin to review and approve the account, then paste the issued key here.
  // See the repo root README's "Provisioning a merchant" section.
  gatewayApiKey: required("GATEWAY_API_KEY"),
};
