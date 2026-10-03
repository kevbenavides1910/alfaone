-- Periodicidad del calendario operativo y aviso un mes antes del cierre.
CREATE TYPE "OperationalCalendarRecurrence" AS ENUM ('NONE', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'YEARLY');

ALTER TABLE "operational_calendar_events"
ADD COLUMN "recurrence" "OperationalCalendarRecurrence" NOT NULL DEFAULT 'NONE',
ADD COLUMN "seriesId" TEXT,
ADD COLUMN "monthBeforeOn" DATE;

UPDATE "operational_calendar_events"
SET "monthBeforeOn" = (("date"::timestamp - INTERVAL '1 month')::date)
WHERE "monthBeforeOn" IS NULL;

CREATE INDEX "operational_calendar_events_seriesId_idx" ON "operational_calendar_events"("seriesId");
CREATE INDEX "operational_calendar_events_monthBeforeOn_idx" ON "operational_calendar_events"("monthBeforeOn");

ALTER TABLE "operational_calendar_event_admins"
ADD COLUMN "monthBeforeSentOn" DATE;
