-- Editores de proceso SIG (permisos finos por proceso)
CREATE TABLE IF NOT EXISTS "sig_process_editors" (
  "id" TEXT NOT NULL,
  "processId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sig_process_editors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sig_process_editors_processId_userId_key"
  ON "sig_process_editors"("processId", "userId");
CREATE INDEX IF NOT EXISTS "sig_process_editors_userId_idx"
  ON "sig_process_editors"("userId");

DO $$ BEGIN
  ALTER TABLE "sig_process_editors"
    ADD CONSTRAINT "sig_process_editors_processId_fkey"
    FOREIGN KEY ("processId") REFERENCES "sig_processes"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "sig_process_editors"
    ADD CONSTRAINT "sig_process_editors_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
