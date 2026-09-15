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

  checkoutSessionTtlMinutes: parseInt(process.env.CHECKOUT_SESSION_TTL_MINUTES || "5", 10),
};
