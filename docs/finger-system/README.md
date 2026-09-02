# Finger System

Sistema integral de administración de asistencia biométrica dentro de **Alfa One**, orientado al departamento de Planillas.

## Qué incluye (Fase 1)

- Módulo `/finger-system` con dashboard, navegación y permisos RBAC
- Modelos PostgreSQL propios (`finger_*`, `app_finger_settings`)
- Capa de integración ATT2016 (diagnóstico SMB, modo lectura por defecto)
- Diagnóstico del sistema en Mantenimiento

## Arquitectura

```
Relojes ZKTeco (TCP 4370) → ZKTecoAdapter → Finger Services → PostgreSQL
ATT2016 (legado SMB) → Att2016Adapter → Finger Services → PostgreSQL
Next.js UI + API (/api/finger-system/*)
```

Finger System es la UI diaria biométrica. ATT2016 queda como respaldo; no hay sync desde Odoo `alfa_biometric`.
## Requisitos

- Node.js 20+, PostgreSQL (Alfa One)
- Acceso de red a `//10.1.1.3/DB-Biometrico` (share ATT2016)
- `smbclient` en el servidor para diagnóstico SMB

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `ATT2016_SMB_SHARE` | Share SMB (default `//10.1.1.3/DB-Biometrico`) |
| `ATT2016_SMB_USER` | Usuario SMB |
| `ATT2016_SMB_PASSWORD` | Contraseña SMB (no en BD) |
| `ATT2016_DATABASE_FILE` | Archivo MDB activo (default `ATT2016.MDB`) |
| `ATT2016_CONNECTION_STRING` | Opcional: SQL Server directo (fase 2) |

## Instalación local

```bash
cd code/presupuestos-alfa
npm install
npx prisma migrate dev
npm run dev
```

Asignar permisos `fingerSystem.*` al rol Planillas en **Mantenimiento → Roles**, o ejecutar `db:seed-roles` en desarrollo.

## Configuración

- UI: `/finger-system/configuracion`
- ATT2016 inicia en **modo solo lectura** (`attReadOnly = true`)

## Documentos relacionados

- [DATABASE.md](./DATABASE.md) — mapa ATT2016 (pendiente introspección)
- [BIOMETRIC_DEVICES.md](./BIOMETRIC_DEVICES.md) — adaptadores de dispositivos
- [SYNC.md](./SYNC.md) — FingerSyncService

## Solución de problemas

| Síntoma | Acción |
|---------|--------|
| Share ATT2016 inaccesible | Verificar `ATT2016_SMB_PASSWORD`, red y permisos en `DB-Biometrico` |
| Sin tile en inicio | Asignar permisos `fingerSystem.dashboard` al rol |
| Dashboard en cero | Normal hasta Fase 3 (sync de marcas y dispositivos) |
