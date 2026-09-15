-- CreateEnum
CREATE TYPE "UserType" AS ENUM ('admin', 'merchant');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('pending', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'completed', 'failed', 'expired', 'refunded', 'partial_refunded');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('approved', 'declined');

-- CreateEnum
CREATE TYPE "DeclineReason" AS ENUM ('CURRENCY_NOT_SUPPORTED', 'INVALID_CARD', 'EXPIRED_CARD', 'CVV_MISMATCH', 'CARD_BLOCKED', 'ACCOUNT_FROZEN', 'ACCOUNT_CLOSED', 'INSUFFICIENT_FUNDS', 'LIMIT_EXCEEDED', 'REFERENCE_NOT_FOUND', 'ORIGINAL_NOT_APPROVED', 'REFUND_EXCEEDS_CHARGE', 'ACCOUNT_NOT_FOUND', 'SESSION_EXPIRED', 'GATEWAY_ERROR');

-- CreateTable
CREATE TABLE "currencies" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banks" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "user_type" "UserType" NOT NULL,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchants" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "store_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "api_key_hash" TEXT NOT NULL,
    "api_key_prefix" TEXT NOT NULL,
    "status" "MerchantStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pricing_plans" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "currency_id" INTEGER NOT NULL,
    "commission_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "commission_fixed" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "settlement_day" INTEGER NOT NULL DEFAULT 3,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pricing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "currency_id" INTEGER NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "currency_id" INTEGER NOT NULL,
    "pricing_plan_id" INTEGER,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "gross_amount" DECIMAL(15,2) NOT NULL,
    "fee_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "refunded_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "decline_reason" "DeclineReason",
    "bank_reference" TEXT,
    "success_url" TEXT NOT NULL,
    "fail_url" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "settlement_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "status" "RefundStatus" NOT NULL,
    "decline_reason" "DeclineReason",
    "bank_refund_reference" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "banks_code_key" ON "banks"("code");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_user_id_key" ON "merchants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_store_id_key" ON "merchants"("store_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_api_key_hash_key" ON "merchants"("api_key_hash");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_plans_merchant_id_currency_id_key" ON "pricing_plans"("merchant_id", "currency_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_merchant_id_currency_id_key" ON "wallets"("merchant_id", "currency_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_invoice_id_key" ON "transactions"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_bank_reference_key" ON "transactions"("bank_reference");

-- CreateIndex
CREATE INDEX "transactions_merchant_id_idx" ON "transactions"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "refunds_idempotency_key_key" ON "refunds"("idempotency_key");

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pricing_plans" ADD CONSTRAINT "pricing_plans_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pricing_plan_id_fkey" FOREIGN KEY ("pricing_plan_id") REFERENCES "pricing_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
