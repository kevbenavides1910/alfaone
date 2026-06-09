-- Otorga presupuestos.facturacion_cobro a roles que ya tienen acceso a contratos
-- (mismo nivel: VIEW, EDIT o ADMIN).

INSERT INTO "role_permissions" ("id", "roleId", "permissionKey", "level")
SELECT
  'perm_fact_cobro_' || rp."roleId",
  rp."roleId",
  'presupuestos.facturacion_cobro',
  rp."level"
FROM "role_permissions" rp
WHERE rp."permissionKey" = 'presupuestos.contracts'
  AND rp."level" <> 'NONE'
ON CONFLICT ("roleId", "permissionKey") DO UPDATE
  SET "level" = EXCLUDED."level";

-- ADMIN: acceso total si el rol existe
INSERT INTO "role_permissions" ("id", "roleId", "permissionKey", "level")
SELECT
  'perm_fact_cobro_admin',
  r."id",
  'presupuestos.facturacion_cobro',
  'ADMIN'::"PermissionLevel"
FROM "roles" r
WHERE r."code" = 'ADMIN'
ON CONFLICT ("roleId", "permissionKey") DO UPDATE
  SET "level" = 'ADMIN'::"PermissionLevel";
