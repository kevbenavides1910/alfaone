-- Avisos del calendario operativo: asignación y recordatorio diario.
ALTER TABLE "operational_calendar_event_admins"
ADD COLUMN "assignedNotifiedAt" TIMESTAMP(3),
ADD COLUMN "lastReminderOn" DATE;

-- Responsables que ya estaban asignados no reciben un «te asignaron» retroactivo.
UPDATE "operational_calendar_event_admins"
SET "assignedNotifiedAt" = "createdAt"
WHERE "assignedNotifiedAt" IS NULL;

CREATE INDEX "operational_calendar_event_admins_lastReminderOn_idx"
ON "operational_calendar_event_admins"("lastReminderOn");
