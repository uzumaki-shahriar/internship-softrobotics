-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'frozen', 'closed');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('active', 'blocked');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('debit', 'credit');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('approved', 'declined');

-- CreateEnum
CREATE TYPE "DeclineReason" AS ENUM ('CURRENCY_NOT_SUPPORTED', 'INVALID_CARD', 'EXPIRED_CARD', 'CVV_MISMATCH', 'CARD_BLOCKED', 'ACCOUNT_FROZEN', 'ACCOUNT_CLOSED', 'INSUFFICIENT_FUNDS', 'LIMIT_EXCEEDED', 'REFERENCE_NOT_FOUND', 'ORIGINAL_NOT_APPROVED', 'REFUND_EXCEEDS_CHARGE');

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" SERIAL NOT NULL,
    "account_number" TEXT NOT NULL,
    "holder_name" TEXT NOT NULL,
    "balance" DECIMAL(15,2) NOT NULL DEFAULT 1000.00,
    "daily_limit" DECIMAL(15,2) NOT NULL DEFAULT 100000.00,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" SERIAL NOT NULL,
    "account_id" INTEGER NOT NULL,
    "card_number" TEXT NOT NULL,
    "card_holder_name" TEXT NOT NULL,
    "expiry_month" INTEGER NOT NULL,
    "expiry_year" INTEGER NOT NULL,
    "cvv" TEXT NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" SERIAL NOT NULL,
    "bank_reference" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "gateway_reference" TEXT NOT NULL,
    "account_id" INTEGER,
    "card_id" INTEGER,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "balance_after" DECIMAL(15,2),
    "status" "TransactionStatus" NOT NULL,
    "decline_reason" "DeclineReason",
    "related_transaction_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admins_email_key" ON "admins"("email");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_account_number_key" ON "accounts"("account_number");

-- CreateIndex
CREATE UNIQUE INDEX "cards_card_number_key" ON "cards"("card_number");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_bank_reference_key" ON "bank_transactions"("bank_reference");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_idempotency_key_key" ON "bank_transactions"("idempotency_key");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_related_transaction_id_fkey" FOREIGN KEY ("related_transaction_id") REFERENCES "bank_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
