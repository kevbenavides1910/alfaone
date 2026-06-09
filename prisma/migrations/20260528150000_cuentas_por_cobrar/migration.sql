-- AlterTable
ALTER TABLE "facturas_mensuales" ADD COLUMN "paidAt" TIMESTAMP(3);
ALTER TABLE "facturas_mensuales" ADD COLUMN "lastPaymentReviewAt" TIMESTAMP(3);

-- Permiso cuentas por cobrar (mismo nivel que facturacion.cobro)
INSERT INTO "role_permissions" ("id", "roleId", "permissionKey", "level")
SELECT
  'perm_fact_cxc_' || rp."roleId",
  rp."roleId",
  'facturacion.cxc',
  rp."level"
FROM "role_permissions" rp
WHERE rp."permissionKey" = 'facturacion.cobro'
  AND rp."level" <> 'NONE'
ON CONFLICT ("roleId", "permissionKey") DO UPDATE
  SET "level" = EXCLUDED."level";

INSERT INTO "role_permissions" ("id", "roleId", "permissionKey", "level")
SELECT
  'perm_fact_cxc_admin',
  r."id",
  'facturacion.cxc',
  'ADMIN'::"PermissionLevel"
FROM "roles" r
WHERE r."code" = 'ADMIN'
ON CONFLICT ("roleId", "permissionKey") DO UPDATE
  SET "level" = 'ADMIN'::"PermissionLevel";
