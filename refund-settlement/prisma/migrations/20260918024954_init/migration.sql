-- CreateEnum
CREATE TYPE "TransactionState" AS ENUM ('Pending', 'Completed', 'PartialRefunded', 'Refunded', 'Failed');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('Pending', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('Pending', 'Completed', 'Failed');

-- CreateEnum
CREATE TYPE "SettlementCycle" AS ENUM ('Daily', 'Weekly', 'Monthly');

-- CreateEnum
CREATE TYPE "RollingPeriod" AS ENUM ('Weekly', 'Monthly');

-- CreateTable
CREATE TABLE "merchants" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "settlement_cycle" "SettlementCycle" NOT NULL DEFAULT 'Daily',
    "rolling_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "rolling_period" "RollingPeriod" NOT NULL DEFAULT 'Monthly',

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "pos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "currency_id" INTEGER NOT NULL,
    "total_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "available_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "blocked_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "rolling_balance" DECIMAL(18,2) NOT NULL DEFAULT 0,
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
    "pos_id" INTEGER NOT NULL,
    "currency_id" INTEGER NOT NULL,
    "gross" DECIMAL(18,2) NOT NULL,
    "fee" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "net" DECIMAL(18,2) NOT NULL,
    "refunded_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "settled_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "settlement_date" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "rolling_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "rolling_release_at" TIMESTAMP(3),
    "rolling_released_at" TIMESTAMP(3),
    "transaction_state" "TransactionState" NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" SERIAL NOT NULL,
    "merchant_id" INTEGER NOT NULL,
    "wallet_id" INTEGER NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'Pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_merchant_id_currency_id_key" ON "wallets"("merchant_id", "currency_id");

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_pos_id_fkey" FOREIGN KEY ("pos_id") REFERENCES "pos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_currency_id_fkey" FOREIGN KEY ("currency_id") REFERENCES "currencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
