-- CreateEnum
CREATE TYPE "ContractHiringType" AS ENUM ('FIXED', 'ON_DEMAND');

-- AlterTable
ALTER TABLE "contracts" ADD COLUMN "hiringType" "ContractHiringType" NOT NULL DEFAULT 'FIXED';
