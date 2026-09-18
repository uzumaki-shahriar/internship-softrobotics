CREATE TYPE "AccountStatus" AS ENUM ('active', 'frozen', 'closed');

CREATE TYPE "AccountType" AS ENUM ('personal', 'business');

CREATE TYPE "CardStatus" AS ENUM ('active', 'blocked');

CREATE TYPE "TransactionType" AS ENUM ('debit', 'credit');

CREATE TYPE "TransactionStatus" AS ENUM ('approved', 'declined', 'pending');

CREATE TYPE "DeclineReason" AS ENUM (
    'CURRENCY_NOT_SUPPORTED',
    'INVALID_CARD',
    'EXPIRED_CARD',
    'CVV_MISMATCH',
    'CARD_BLOCKED',
    'ACCOUNT_FROZEN',
    'ACCOUNT_CLOSED',
    'INSUFFICIENT_FUNDS',
    'LIMIT_EXCEEDED',
    'REFERENCE_NOT_FOUND',
    'ORIGINAL_NOT_APPROVED',
    'REFUND_EXCEEDS_CHARGE',
    'ACCOUNT_NOT_FOUND',
    'OTP_FAILED',
    'OTP_EXPIRED'
);

CREATE TYPE "OtpStatus" AS ENUM ('pending', 'verified', 'failed', 'expired');

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

CREATE TABLE "admins" (
    "id"            SERIAL PRIMARY KEY,
    "name"          TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "passwordHash"  TEXT NOT NULL,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_email_key" UNIQUE ("email")
);

CREATE TABLE "accounts" (
    "id"             SERIAL PRIMARY KEY,
    "account_number" TEXT NOT NULL,
    "holder_name"    TEXT NOT NULL,
    "type"           "AccountType" NOT NULL DEFAULT 'personal',
    "balance"        DECIMAL(15,2) NOT NULL DEFAULT 1000.00,
    "daily_limit"    DECIMAL(15,2) NOT NULL DEFAULT 100000.00,
    "status"         "AccountStatus" NOT NULL DEFAULT 'active',
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_account_number_key" UNIQUE ("account_number")
);

CREATE TABLE "cards" (
    "id"               SERIAL PRIMARY KEY,
    "account_id"       INTEGER NOT NULL,
    "card_number"      TEXT NOT NULL,
    "card_holder_name" TEXT NOT NULL,
    "expiry_month"     INTEGER NOT NULL,
    "expiry_year"      INTEGER NOT NULL,
    "cvv"              TEXT NOT NULL,
    "status"           "CardStatus" NOT NULL DEFAULT 'active',
    "created_at"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_card_number_key" UNIQUE ("card_number"),
    CONSTRAINT "cards_account_id_fkey" FOREIGN KEY ("account_id")
        REFERENCES "accounts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "bank_transactions" (
    "id"                      SERIAL PRIMARY KEY,
    "bank_reference"          TEXT NOT NULL,
    "idempotency_key"         TEXT NOT NULL,
    "gateway_reference"       TEXT NOT NULL,
    "account_id"              INTEGER,
    "card_id"                 INTEGER,
    "type"                    "TransactionType" NOT NULL,
    "amount"                  DECIMAL(15,2) NOT NULL,
    "currency"                TEXT NOT NULL,
    "balance_after"           DECIMAL(15,2),
    "status"                  "TransactionStatus" NOT NULL,
    "decline_reason"          "DeclineReason",
    "related_transaction_id"  INTEGER,
    "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_bank_reference_key" UNIQUE ("bank_reference"),
    CONSTRAINT "bank_transactions_idempotency_key_key" UNIQUE ("idempotency_key"),
    CONSTRAINT "bank_transactions_account_id_fkey" FOREIGN KEY ("account_id")
        REFERENCES "accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bank_transactions_card_id_fkey" FOREIGN KEY ("card_id")
        REFERENCES "cards" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "bank_transactions_related_transaction_id_fkey" FOREIGN KEY ("related_transaction_id")
        REFERENCES "bank_transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "otp_challenges" (
    "id"             SERIAL PRIMARY KEY,
    "transaction_id" INTEGER NOT NULL,
    "code"           TEXT NOT NULL,
    "attempt_count"  INTEGER NOT NULL DEFAULT 0,
    "status"         "OtpStatus" NOT NULL DEFAULT 'pending',
    "expires_at"     TIMESTAMP(3) NOT NULL,
    "return_url"     TEXT NOT NULL,
    "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_challenges_transaction_id_key" UNIQUE ("transaction_id"),
    CONSTRAINT "otp_challenges_transaction_id_fkey" FOREIGN KEY ("transaction_id")
        REFERENCES "bank_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
