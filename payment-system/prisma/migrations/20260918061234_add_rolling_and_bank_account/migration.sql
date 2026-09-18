-- AlterTable
ALTER TABLE "merchants" ADD COLUMN     "bank_account_number" TEXT;

-- AlterTable
ALTER TABLE "pricing_plans" ADD COLUMN     "rolling_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "rolling_period" TEXT NOT NULL DEFAULT 'monthly';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "blocked_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "rolling_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "rolling_release_at" TIMESTAMP(3),
ADD COLUMN     "rolling_released_at" TIMESTAMP(3),
ADD COLUMN     "settled_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "wallets" ADD COLUMN     "blocked_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "rolling_amount" DECIMAL(15,2) NOT NULL DEFAULT 0;
