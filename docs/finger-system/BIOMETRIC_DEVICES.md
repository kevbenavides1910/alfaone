# BIOMETRIC_DEVICES.md

## Capas

```
BiometricDeviceInterface (types.ts)
  └── ZKTecoAdapter (TCP 4370) — fuente principal
  └── ATT2016Adapter — respaldo / legado

Finger device services:
  finger-device-push / enroll / pull
  finger-sync-orchestrator (probe + pull ZK + ATT)
```

## Fuente operativa

- **Principal:** relojes ZKTeco en red (`finger_devices`, puerto 4370).
- **Respaldo:** ATT2016 (SMB/MDB) para import histórico y sync de respaldo.
- **UI diaria:** Finger System en Alfa One (`/finger-system`). No hay puente a tablas Odoo `alfa.biometric.*`.

## Capacidades ZK

| Acción | Servicio / API |
|--------|----------------|
| Push usuario (`set_user` + templates) | `POST /api/finger-system/employees/[id]/push-devices` |
| Enrolar huella + distribuir | `POST /api/finger-system/biometrics/enroll` (`employeeId`) |
| Traer usuarios | `POST .../devices/[id]` `{ action: "pull-users" }` |
| Traer marcas | `POST .../devices/[id]` `{ action: "pull-attendance" }` o `pull-all-attendance` |
| Historial | `GET /api/finger-system/punches` · UI `/finger-system/marcas` |

## Modelo (`finger_devices` / punches)

- Dispositivos: nombre, IP, puerto, marca, modelo, empresa, ubicación, estado, contadores.
- Marcas: `FingerPunch.source` = `DEVICE` \| `ATT2016`; `deviceId` opcional.
- Asignación selectiva: `FingerEmployeeDevice` (empleado ↔ relojes).

## Seed de relojes Odoo

IPs típicas (idempotente, no pisa config existente): Piso 01/02, Alajuela, Centro Comercial — ver `finger-devices-seed.ts`.

## Descubrimiento / estado

- Puerto default 4370; estados ONLINE / OFFLINE / ERROR / UNKNOWN.
- Cron: tras probe, pull de asistencia ZK (últimos 2–3 días) + ATT2016.

## Seguridad

- Credenciales de dispositivos **nunca** en código fuente.
- Usar variables de entorno o secretos del servidor.
