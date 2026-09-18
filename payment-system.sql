CREATE TYPE "UserType" AS ENUM ('admin', 'merchant');

-- pending: registered, not yet reviewed - API key exists but every
-- authenticated call is rejected. active: admin has approved and assigned
-- a commission. suspended: admin has since disabled the merchant.
CREATE TYPE "MerchantStatus" AS ENUM ('pending', 'active', 'suspended');

CREATE TYPE "TransactionStatus" AS ENUM (
    'pending',
    'completed',
    'failed',
    'expired',
    'refunded',
    'partial_refunded'
);

CREATE TYPE "RefundStatus" AS ENUM ('approved', 'declined');

-- Gateway-only additions (SESSION_EXPIRED, GATEWAY_ERROR, TOO_MANY_ATTEMPTS,
-- CANCELLED) sit alongside the exact set the Bank System returns - see
-- bank-system/README.md.
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
    'OTP_EXPIRED',
    'SESSION_EXPIRED',
    'GATEWAY_ERROR',
    'TOO_MANY_ATTEMPTS',
    'CANCELLED'
);

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------

CREATE TABLE "currencies" (
    "id"         SERIAL PRIMARY KEY,
    "name"       TEXT NOT NULL,
    "symbol"     TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_code_key" UNIQUE ("code")
);

CREATE TABLE "banks" (
    "id"         SERIAL PRIMARY KEY,
    "name"       TEXT NOT NULL,
    "code"       TEXT NOT NULL,
    "status"     BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banks_code_key" UNIQUE ("code")
);

CREATE TABLE "users" (
    "id"            SERIAL PRIMARY KEY,
    "name"          TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "user_type"     "UserType" NOT NULL,
    "status"        BOOLEAN NOT NULL DEFAULT true,
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_email_key" UNIQUE ("email")
);

CREATE TABLE "merchants" (
    "id"                   SERIAL PRIMARY KEY,
    "user_id"              INTEGER NOT NULL,
    "store_id"             TEXT NOT NULL,
    "name"                 TEXT NOT NULL,
    "address"              TEXT,
    "api_key_hash"         TEXT NOT NULL,
    "api_key_prefix"       TEXT NOT NULL,
    "status"               "MerchantStatus" NOT NULL DEFAULT 'pending',
    "bank_account_number"  TEXT,
    "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"           TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_user_id_key" UNIQUE ("user_id"),
    CONSTRAINT "merchants_store_id_key" UNIQUE ("store_id"),
    CONSTRAINT "merchants_api_key_hash_key" UNIQUE ("api_key_hash"),
    CONSTRAINT "merchants_user_id_fkey" FOREIGN KEY ("user_id")
        REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "pricing_plans" (
    "id"                     SERIAL PRIMARY KEY,
    "merchant_id"            INTEGER NOT NULL,
    "currency_id"            INTEGER NOT NULL,
    "commission_percentage"  DECIMAL(5,2) NOT NULL DEFAULT 0,
    "commission_fixed"       DECIMAL(10,2) NOT NULL DEFAULT 0,
    "settlement_day"         INTEGER NOT NULL DEFAULT 3,
    "rolling_percentage"     DECIMAL(5,2) NOT NULL DEFAULT 0,
    "rolling_period"         TEXT NOT NULL DEFAULT 'monthly',
    "status"                 BOOLEAN NOT NULL DEFAULT true,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_plans_merchant_id_currency_id_key" UNIQUE ("merchant_id", "currency_id"),
    CONSTRAINT "pricing_plans_merchant_id_fkey" FOREIGN KEY ("merchant_id")
        REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pricing_plans_currency_id_fkey" FOREIGN KEY ("currency_id")
        REFERENCES "currencies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "wallets" (
    "id"              SERIAL PRIMARY KEY,
    "merchant_id"     INTEGER NOT NULL,
    "currency_id"     INTEGER NOT NULL,
    "balance"         DECIMAL(15,2) NOT NULL DEFAULT 0,
    "blocked_amount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
    "rolling_amount"  DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_merchant_id_currency_id_key" UNIQUE ("merchant_id", "currency_id"),
    CONSTRAINT "wallets_merchant_id_fkey" FOREIGN KEY ("merchant_id")
        REFERENCES "merchants" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "wallets_currency_id_fkey" FOREIGN KEY ("currency_id")
        REFERENCES "currencies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "transactions" (
    "id"                    SERIAL PRIMARY KEY,
    "invoice_id"            TEXT NOT NULL,
    "order_id"              TEXT NOT NULL,
    "merchant_id"           INTEGER NOT NULL,
    "currency_id"           INTEGER NOT NULL,
    "pricing_plan_id"       INTEGER,
    "status"                "TransactionStatus" NOT NULL DEFAULT 'pending',
    "gross_amount"          DECIMAL(15,2) NOT NULL,
    "fee_amount"            DECIMAL(15,2) NOT NULL DEFAULT 0,
    "net_amount"            DECIMAL(15,2) NOT NULL DEFAULT 0,
    "refunded_amount"       DECIMAL(15,2) NOT NULL DEFAULT 0,
    "decline_reason"        "DeclineReason",
    "bank_reference"        TEXT,
    "attempt_count"         INTEGER NOT NULL DEFAULT 0,
    "current_attempt_token" TEXT,
    "success_url"           TEXT NOT NULL,
    "fail_url"              TEXT NOT NULL,
    "expires_at"            TIMESTAMP(3) NOT NULL,
    "blocked_amount"        DECIMAL(15,2) NOT NULL DEFAULT 0,
    "settlement_date"       DATE,
    "settled_at"            TIMESTAMP(3),
    "rolling_amount"        DECIMAL(15,2) NOT NULL DEFAULT 0,
    "rolling_release_at"    TIMESTAMP(3),
    "rolling_released_at"   TIMESTAMP(3),
    "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"            TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_invoice_id_key" UNIQUE ("invoice_id"),
    CONSTRAINT "transactions_bank_reference_key" UNIQUE ("bank_reference"),
    CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id")
        REFERENCES "merchants" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_currency_id_fkey" FOREIGN KEY ("currency_id")
        REFERENCES "currencies" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "transactions_pricing_plan_id_fkey" FOREIGN KEY ("pricing_plan_id")
        REFERENCES "pricing_plans" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "transactions_merchant_id_idx" ON "transactions" ("merchant_id");

CREATE TABLE "refunds" (
    "id"                     SERIAL PRIMARY KEY,
    "transaction_id"         INTEGER NOT NULL,
    "invoice_id"             TEXT NOT NULL,
    "amount"                 DECIMAL(15,2) NOT NULL,
    "status"                 "RefundStatus" NOT NULL,
    "decline_reason"         "DeclineReason",
    "bank_refund_reference"  TEXT,
    "idempotency_key"        TEXT NOT NULL,
    "created_at"             TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"             TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_idempotency_key_key" UNIQUE ("idempotency_key"),
    CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id")
        REFERENCES "transactions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
