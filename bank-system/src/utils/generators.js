const crypto = require("crypto");
const config = require("../config");

function randomDigits(length) {
  let out = "";
  for (let i = 0; i < length; i++) out += crypto.randomInt(0, 10);
  return out;
}

// Luhn checksum digit so generated card numbers pass the standard validation
// real card processors run before ever looking at the account.
function luhnCheckDigit(numberWithoutCheckDigit) {
  let sum = 0;
  let alternate = true; // rightmost digit of the (n-1)-length number is doubled first
  for (let i = numberWithoutCheckDigit.length - 1; i >= 0; i--) {
    let digit = parseInt(numberWithoutCheckDigit[i], 10);
    if (alternate) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    alternate = !alternate;
  }
  return (10 - (sum % 10)) % 10;
}

// Deterministic numeric-only digest of a string, e.g. "NB001" -> "483920".
// Used to derive a BIN prefix from the bank code without risking non-digit
// characters (a plain hex encoding can contain a-f, which broke the Luhn
// check digit computation below - digits only, always).
function digitHash(value, length) {
  let hash = 0;
  for (const ch of value) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash.toString().padStart(length, "0").slice(0, length);
}

function generateCardNumber() {
  // 6-digit BIN derived from the bank code so cards from different bank
  // instances don't collide, + 9 random digits + 1 Luhn check digit = 16.
  const bin = digitHash(config.bankCode, 6);
  const body = bin + randomDigits(9);
  return body + luhnCheckDigit(body);
}

function generateCvv() {
  return randomDigits(3);
}

function generateAccountNumber() {
  return config.bankCode.replace(/[^A-Z0-9]/gi, "").slice(0, 4).toUpperCase() + randomDigits(10);
}

function generateBankReference() {
  return `TXN-${config.bankCode}-${Date.now().toString(36).toUpperCase()}-${randomDigits(4)}`;
}

function generateOtpCode() {
  return randomDigits(6);
}

module.exports = {
  generateCardNumber,
  generateCvv,
  generateAccountNumber,
  generateBankReference,
  generateOtpCode,
};
