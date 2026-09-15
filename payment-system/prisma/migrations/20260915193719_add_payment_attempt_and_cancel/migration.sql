-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DeclineReason" ADD VALUE 'TOO_MANY_ATTEMPTS';
ALTER TYPE "DeclineReason" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "attempt_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "current_attempt_token" TEXT;
