-- Catálogo editable de tipos de evento del calendario operativo (reemplaza el enum fijo).

-- CreateTable
CREATE TABLE "operational_event_types" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operational_event_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operational_event_types_name_key" ON "operational_event_types"("name");

-- Tipos iniciales (los que antes eran fijos en el código)
INSERT INTO "operational_event_types" ("id", "name", "color", "sortOrder", "updatedAt") VALUES
  ('oet_uniform_change',  'Cambio de uniformes',      'blue',    0, CURRENT_TIMESTAMP),
  ('oet_supply_delivery', 'Entrega de insumos',       'amber',   1, CURRENT_TIMESTAMP),
  ('oet_inspection',      'Inspección / supervisión', 'purple',  2, CURRENT_TIMESTAMP),
  ('oet_training',        'Capacitación',             'emerald', 3, CURRENT_TIMESTAMP),
  ('oet_meeting',         'Reunión con cliente',      'pink',    4, CURRENT_TIMESTAMP),
  ('oet_other',           'Otro',                     'gray',    5, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Eventos existentes: enum → FK al catálogo
ALTER TABLE "operational_calendar_events" ADD COLUMN "typeId" TEXT;
UPDATE "operational_calendar_events" SET "typeId" = 'oet_' || lower("type"::text);
ALTER TABLE "operational_calendar_events" ALTER COLUMN "typeId" SET NOT NULL;

DROP INDEX "operational_calendar_events_type_idx";
ALTER TABLE "operational_calendar_events" DROP COLUMN "type";
DROP TYPE "OperationalEventType";

-- CreateIndex
CREATE INDEX "operational_calendar_events_typeId_idx" ON "operational_calendar_events"("typeId");

-- AddForeignKey
ALTER TABLE "operational_calendar_events" ADD CONSTRAINT "operational_calendar_events_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "operational_event_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
