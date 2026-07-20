-- Índices para acelerar agregaciones del dashboard de facturación (filtros por fecha).
CREATE INDEX IF NOT EXISTS "cxc_documentos_dueDate_idx" ON "cxc_documentos" ("dueDate");
CREATE INDEX IF NOT EXISTS "cxc_documentos_paidAt_idx" ON "cxc_documentos" ("paidAt");
CREATE INDEX IF NOT EXISTS "cxc_documentos_cxcExpectedPaymentDate_idx" ON "cxc_documentos" ("cxcExpectedPaymentDate");
CREATE INDEX IF NOT EXISTS "cxc_documentos_docType_status_dueDate_idx" ON "cxc_documentos" ("docType", "status", "dueDate");
CREATE INDEX IF NOT EXISTS "cxc_documentos_isReajuste_docType_dueDate_idx" ON "cxc_documentos" ("isReajuste", "docType", "dueDate");
