-- CreateEnum
CREATE TYPE "OtpStatus" AS ENUM ('pending', 'verified', 'failed', 'expired');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeclineReason" ADD VALUE 'OTP_FAILED';
ALTER TYPE "DeclineReason" ADD VALUE 'OTP_EXPIRED';

-- AlterEnum
ALTER TYPE "TransactionStatus" ADD VALUE 'pending';

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "status" "OtpStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "otp_challenges_transaction_id_key" ON "otp_challenges"("transaction_id");

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "bank_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
