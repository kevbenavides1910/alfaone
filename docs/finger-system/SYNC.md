# SYNC.md — FingerSyncService

## Estado actual (Fase 1)

- Tabla `finger_sync_logs` para historial
- Configuración en `app_finger_settings` (`syncAutoEnabled`, `syncIntervalMinutes`)
- Worker independiente: **pendiente** (Fase 4)

## Operaciones planificadas

| Operación | Dirección | Descripción |
|-----------|-----------|-------------|
| `employees` | PUSH/PULL | Sincronizar empleados |
| `punches` | PULL | Descargar marcas |
| `fingerprints` | PUSH/PULL | Huellas |
| `schedules` | PUSH | Turnos/horarios |

## Modos

- **Manual:** desde UI Dispositivos / Mantenimiento
- **Automático:** cron/worker según `syncIntervalMinutes`

## Reglas

1. ATT2016 en lectura hasta pruebas y backup
2. Reintentos con registro en `finger_sync_logs`
3. Auditoría en `finger_operation_logs`

## Formato de respaldo

`FingerSystem_YYYY-MM-DD_HHmmss` (Fase 8)
