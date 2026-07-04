CREATE TABLE "app_facturacion_cobro_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "emailFixedCc" TEXT,
    "emailSubjectTemplate" TEXT NOT NULL DEFAULT 'Recordatorio de pago — {{cliente}} — {{numero_factura}}',
    "emailBodyTemplate" TEXT NOT NULL DEFAULT E'Estimado/a {{contacto_nombre}}:\n\nPor medio de la presente le recordamos que la factura {{numero_factura}} correspondiente al periodo {{periodo}} por un monto de {{total}} se encuentra pendiente de pago.\n\nFecha de vencimiento: {{fecha_vencimiento}}\nDias vencidos: {{dias_vencidos}}\n\nAgradecemos gestionar el pago a la brevedad posible.\n\nEste mensaje fue enviado automaticamente desde Syntra Dynamics.',
    "mailProvider" TEXT NOT NULL DEFAULT 'CUSTOM_SMTP',
    "smtpHost" TEXT,
    "smtpPort" INTEGER,
    "smtpSecure" BOOLEAN,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpFrom" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_facturacion_cobro_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "app_facturacion_cobro_settings" ("id", "updatedAt")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
