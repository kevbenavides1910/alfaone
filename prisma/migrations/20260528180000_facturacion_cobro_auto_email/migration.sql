ALTER TABLE "facturas_mensuales" ADD COLUMN "lastDueReminderEmailAt" TIMESTAMP(3);
ALTER TABLE "facturas_mensuales" ADD COLUMN "lastCollectionEmailAt" TIMESTAMP(3);

ALTER TABLE "app_facturacion_cobro_settings" ADD COLUMN "autoDueReminderEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_facturacion_cobro_settings" ADD COLUMN "autoCollectionEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "app_facturacion_cobro_settings" ADD COLUMN "collectionEmailIntervalDays" INTEGER NOT NULL DEFAULT 7;
ALTER TABLE "app_facturacion_cobro_settings" ADD COLUMN "lastAutoEmailRunAt" TIMESTAMP(3);
