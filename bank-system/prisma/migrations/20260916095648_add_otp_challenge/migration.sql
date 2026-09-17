/*
  Warnings:

  - Added the required column `return_url` to the `otp_challenges` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "otp_challenges" ADD COLUMN     "return_url" TEXT NOT NULL;
