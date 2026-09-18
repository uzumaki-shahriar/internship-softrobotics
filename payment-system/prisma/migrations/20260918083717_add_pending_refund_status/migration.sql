-- AlterEnum
ALTER TYPE "RefundStatus" ADD VALUE 'pending';

-- AlterTable
ALTER TABLE "refunds" ADD COLUMN     "wallet_debit" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "wallet_settled_at" TIMESTAMP(3);
