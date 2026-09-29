-- CreateEnum
CREATE TYPE "OperationalEventType" AS ENUM ('UNIFORM_CHANGE', 'SUPPLY_DELIVERY', 'INSPECTION', 'TRAINING', 'MEETING', 'OTHER');

-- CreateEnum
CREATE TYPE "OperationalEventStatus" AS ENUM ('SCHEDULED', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "operational_calendar_events" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "title" TEXT NOT NULL,
    "type" "OperationalEventType" NOT NULL DEFAULT 'OTHER',
    "status" "OperationalEventStatus" NOT NULL DEFAULT 'SCHEDULED',
    "description" TEXT,
    "zoneId" TEXT,
    "appliesToAllContracts" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT,
    "createdByName" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_calendar_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_calendar_event_contracts" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_calendar_event_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "operational_calendar_events_date_idx" ON "operational_calendar_events"("date");

-- CreateIndex
CREATE INDEX "operational_calendar_events_zoneId_idx" ON "operational_calendar_events"("zoneId");

-- CreateIndex
CREATE INDEX "operational_calendar_events_type_idx" ON "operational_calendar_events"("type");

-- CreateIndex
CREATE INDEX "operational_calendar_event_contracts_contractId_idx" ON "operational_calendar_event_contracts"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "operational_calendar_event_contracts_eventId_contractId_key" ON "operational_calendar_event_contracts"("eventId", "contractId");

-- AddForeignKey
ALTER TABLE "operational_calendar_events" ADD CONSTRAINT "operational_calendar_events_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_calendar_event_contracts" ADD CONSTRAINT "operational_calendar_event_contracts_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "operational_calendar_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operational_calendar_event_contracts" ADD CONSTRAINT "operational_calendar_event_contracts_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
