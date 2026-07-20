# Módulo Monitoreo — alarmas y operaciones

Antes llamado **Bandeco**. Rutas UI: `/monitoreo`. APIs: `/api/monitoreo`.
Las tablas Prisma conservan el prefijo histórico `bandeco_*`.

| Ruta | Función |
|------|---------|
| `/monitoreo` | Consulta por código y mensajes WhatsApp |
| `/monitoreo/activaciones` | Registro e informe (+ fotos Ctrl+V) |
| `/monitoreo/registro` | Historial |
| `/monitoreo/aperturas-cierres` | Aperturas y cierres |
| `/monitoreo/eventos` | Eventos / bitácora (+ fotos Ctrl+V) |
| `/monitoreo/pilas` | Registro diario de llenado + recomendaciones |
| `/monitoreo/informe-semanal` | Informe semanal |
| `/monitoreo/mantenimientos` | Catálogos e importación XLSM |

## Permisos

- `monitoreo.consulta`
- `monitoreo.operacion`
- `monitoreo.registros`
- `monitoreo.mantenimientos`
