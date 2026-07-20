-- Alias bandeco.* durante transición de despliegue (código viejo + nuevo)
INSERT INTO "role_permissions" ("id", "roleId", "permissionKey", "level")
SELECT md5(random()::text || clock_timestamp()::text), rp."roleId",
       REPLACE(rp."permissionKey", 'monitoreo.', 'bandeco.'), rp."level"
FROM "role_permissions" rp
WHERE rp."permissionKey" LIKE 'monitoreo.%'
  AND NOT EXISTS (
    SELECT 1 FROM "role_permissions" x
    WHERE x."roleId" = rp."roleId"
      AND x."permissionKey" = REPLACE(rp."permissionKey", 'monitoreo.', 'bandeco.')
  );
