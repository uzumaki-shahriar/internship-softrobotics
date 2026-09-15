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

  // Only used once, by src/bootstrap.js, to self-register this shop as a
  // merchant and get admin-approved - never used again after that succeeds
  // (the resulting API key lives in the DB's ShopConfig row from then on).
  bootstrap: {
    ownerName: process.env.SHOP_OWNER_NAME || "Bookworm Cafe Owner",
    ownerEmail: process.env.SHOP_OWNER_EMAIL || "owner@bookwormcafe.example",
    // Fixed (not random) so a bootstrap that crashes after registering but
    // before saving ShopConfig can recover by logging back in with it -
    // this password is a formality for the Gateway's registration API; the
    // credential this shop actually uses day to day is the API key.
    ownerPassword: process.env.SHOP_OWNER_PASSWORD || "change-me-not-used-day-to-day",
    storeName: process.env.SHOP_STORE_NAME || "Bookworm Cafe",
    adminEmail: process.env.GATEWAY_ADMIN_EMAIL,
    adminPassword: process.env.GATEWAY_ADMIN_PASSWORD,
    commissionPercentage: parseFloat(process.env.SHOP_COMMISSION_PERCENTAGE || "2.5"),
    commissionFixed: parseFloat(process.env.SHOP_COMMISSION_FIXED || "5"),
  },
};
