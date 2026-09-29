-- AlterTable
ALTER TABLE "operational_calendar_events" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "completedByName" TEXT;

UPDATE "operational_calendar_events" SET "completedAt" = "updatedAt" WHERE "status" = 'DONE' AND "completedAt" IS NULL;

-- CreateTable
CREATE TABLE "operational_calendar_event_admins" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_calendar_event_admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_calendar_event_attachments" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contractId" TEXT,
    "uploadedById" TEXT,
    "uploadedByName" TEXT,
    "originalName" TEXT NOT NULL,
    "storedName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_calendar_event_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_calendar_event_admins_userId_idx" ON "operational_calendar_event_admins"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "operational_calendar_event_admins_eventId_userId_key" ON "operational_calendar_event_admins"("eventId", "userId");

-- CreateIndex
CREATE INDEX "operational_calendar_event_attachments_eventId_idx" ON "operational_calendar_event_attachments"("eventId");

-- CreateIndex
CREATE INDEX "operational_calendar_event_attachments_contractId_idx" ON "operational_calendar_event_attachments"("contractId");

-- AddForeignKey
ALTER TABLE "operational_calendar_event_admins" ADD CONSTRAINT "operational_calendar_event_admins_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "operational_calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_calendar_event_admins" ADD CONSTRAINT "operational_calendar_event_admins_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_calendar_event_attachments" ADD CONSTRAINT "operational_calendar_event_attachments_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "operational_calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_calendar_event_attachments" ADD CONSTRAINT "operational_calendar_event_attachments_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
