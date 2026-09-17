require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

module.exports = {
  bankName: process.env.BANK_NAME || "Demo Bank",
  bankCode: process.env.BANK_CODE || "DEMO001",
  currency: process.env.BANK_CURRENCY || "BDT",
  port: parseInt(process.env.PORT || "8001", 10),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: required("DATABASE_URL"),
  apiKey: required("BANK_API_KEY"),
  sessionSecret: required("SESSION_SECRET"),
  logLevel: process.env.LOG_LEVEL || "info",
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || "5", 10),
  otpMaxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || "3", 10),
};
