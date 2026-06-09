-- Rebrand: Syntra Dynamics / Control de Rentabilidad → Alfa One

UPDATE "app_disciplinary_settings"
SET "documentFooter" = 'Documento generado desde Alfa One.'
WHERE "documentFooter" ILIKE '%Syntra%'
   OR "documentFooter" ILIKE '%Grupo Alfa%'
   OR "documentFooter" ILIKE '%Control de Rentabilidad%';

ALTER TABLE "app_disciplinary_settings"
  ALTER COLUMN "documentFooter" SET DEFAULT 'Documento generado desde Alfa One.';

ALTER TABLE "app_disciplinary_settings"
  ALTER COLUMN "emailBodyTemplate" SET DEFAULT E'Estimado/a {{nombre}}:\\n\\nSe registra el apercibimiento {{numero}} por {{omisiones_count}} omision(es) de marca. Adjuntamos la constancia en PDF.\\n\\nEste mensaje fue enviado automaticamente desde Alfa One.';

UPDATE "app_disciplinary_settings"
SET "emailBodyTemplate" = REPLACE("emailBodyTemplate", 'el sistema de control', 'Alfa One')
WHERE "emailBodyTemplate" ILIKE '%sistema de control%';

UPDATE "app_facturacion_cobro_settings"
SET "emailBodyTemplate" = REPLACE("emailBodyTemplate", 'Syntra Dynamics', 'Alfa One')
WHERE "emailBodyTemplate" ILIKE '%Syntra Dynamics%';

UPDATE "app_facturacion_cobro_settings"
SET "dueReminderBodyTemplate" = REPLACE("dueReminderBodyTemplate", 'Syntra Dynamics', 'Alfa One')
WHERE "dueReminderBodyTemplate" ILIKE '%Syntra Dynamics%';

ALTER TABLE "app_facturacion_cobro_settings"
  ALTER COLUMN "emailBodyTemplate" SET DEFAULT E'Estimado/a {{contacto_nombre}}:\n\nPor medio de la presente le recordamos que la factura {{numero_factura}} correspondiente al periodo {{periodo}} por un monto de {{total}} se encuentra pendiente de pago.\n\nFecha de vencimiento: {{fecha_vencimiento}}\nDias vencidos: {{dias_vencidos}}\n\nAgradecemos gestionar el pago a la brevedad posible.\n\nEste mensaje fue enviado automaticamente desde Alfa One.';

ALTER TABLE "app_facturacion_cobro_settings"
  ALTER COLUMN "dueReminderBodyTemplate" SET DEFAULT E'Estimado/a {{contacto_nombre}}:\n\nLe informamos que la factura {{numero_factura}} correspondiente al periodo {{periodo}} por un monto de {{total}} vence el {{fecha_vencimiento}} (faltan {{dias_hasta_vencimiento}} dia(s) para el vencimiento).\n\nAgradecemos adelantar las gestiones de pago correspondientes para evitar retrasos.\n\nEste mensaje fue enviado automaticamente desde Alfa One.';
