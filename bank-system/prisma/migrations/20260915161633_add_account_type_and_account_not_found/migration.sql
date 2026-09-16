-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('personal', 'business');

-- AlterEnum
ALTER TYPE "DeclineReason" ADD VALUE 'ACCOUNT_NOT_FOUND';

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "type" "AccountType" NOT NULL DEFAULT 'personal';
