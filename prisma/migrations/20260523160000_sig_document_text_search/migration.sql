-- CreateEnum
CREATE TYPE "SigTextIndexStatus" AS ENUM ('PENDING', 'DONE', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "sig_document_versions" ADD COLUMN "extractedText" TEXT,
ADD COLUMN "textIndexStatus" "SigTextIndexStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "textIndexedAt" TIMESTAMP(3);
