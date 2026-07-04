-- Renombra permiso al módulo independiente Facturación y cobro.
UPDATE "role_permissions"
SET "permissionKey" = 'facturacion.cobro'
WHERE "permissionKey" = 'presupuestos.facturacion_cobro';
