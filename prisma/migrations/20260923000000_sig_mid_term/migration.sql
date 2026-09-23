-- SIG medio plazo: supersesión documental + campañas de lectura/acuse
ALTER TABLE "sig_documents"
  ADD COLUMN IF NOT EXISTS "supersededById" TEXT,
  ADD COLUMN IF NOT EXISTS "obsoleteAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "obsoleteReason" TEXT;

CREATE TABLE IF NOT EXISTS "sig_document_read_campaigns" (
  "id" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "versionId" TEXT,
  "supersedesDocumentId" TEXT,
  "title" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sig_document_read_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sig_document_read_assignees" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sig_document_read_assignees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "sig_document_acknowledgments" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "versionId" TEXT,
  "documentId" TEXT,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "sig_document_acknowledgments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sig_document_read_assignees_campaignId_userId_key"
  ON "sig_document_read_assignees"("campaignId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "sig_document_acknowledgments_campaignId_userId_key"
  ON "sig_document_acknowledgments"("campaignId", "userId");
CREATE INDEX IF NOT EXISTS "sig_documents_supersededById_idx" ON "sig_documents"("supersededById");
CREATE INDEX IF NOT EXISTS "sig_document_read_campaigns_documentId_idx" ON "sig_document_read_campaigns"("documentId");
CREATE INDEX IF NOT EXISTS "sig_document_read_assignees_userId_idx" ON "sig_document_read_assignees"("userId");
CREATE INDEX IF NOT EXISTS "sig_document_acknowledgments_userId_idx" ON "sig_document_acknowledgments"("userId");
CREATE INDEX IF NOT EXISTS "sig_document_acknowledgments_documentId_idx" ON "sig_document_acknowledgments"("documentId");

ALTER TABLE "sig_document_acknowledgments"
  ADD COLUMN IF NOT EXISTS "documentId" TEXT;

DO $$ BEGIN
  ALTER TABLE "sig_documents"
    ADD CONSTRAINT "sig_documents_supersededById_fkey"
    FOREIGN KEY ("supersededById") REFERENCES "sig_documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_read_campaigns"
    ADD CONSTRAINT "sig_document_read_campaigns_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "sig_documents"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_read_campaigns"
    ADD CONSTRAINT "sig_document_read_campaigns_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "sig_document_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_read_campaigns"
    ADD CONSTRAINT "sig_document_read_campaigns_supersedesDocumentId_fkey"
    FOREIGN KEY ("supersedesDocumentId") REFERENCES "sig_documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_read_campaigns"
    ADD CONSTRAINT "sig_document_read_campaigns_createdById_fkey"
    FOREIGN KEY ("createdById") REFERENCES "users"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_read_assignees"
    ADD CONSTRAINT "sig_document_read_assignees_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "sig_document_read_campaigns"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_read_assignees"
    ADD CONSTRAINT "sig_document_read_assignees_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_acknowledgments"
    ADD CONSTRAINT "sig_document_acknowledgments_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "sig_document_read_campaigns"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_acknowledgments"
    ADD CONSTRAINT "sig_document_acknowledgments_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_acknowledgments"
    ADD CONSTRAINT "sig_document_acknowledgments_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "sig_document_versions"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_document_acknowledgments"
    ADD CONSTRAINT "sig_document_acknowledgments_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "sig_documents"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
