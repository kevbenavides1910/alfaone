# BIOMETRIC_DEVICES.md

## Capas

```
Odoo Postgres (syntradata)  ← lectura primaria de padrón/marcas
  alfa_biometric_device / _user / _punch

ZKTecoAdapter (TCP 4370)    ← push / enroll / pull en vivo
  → upsert marcas en Odoo + cache finger_*

ATT2016 (SMB)               ← legado (Configuración / Backups)
```

## Fuente operativa

- **Ver todo (UI):** tablas Odoo `alfa_biometric_*` vía `ODOO_BIOMETRIC_DATABASE_URL`.
- **Operar reloj:** TCP 4370 desde Alfa (`set_user`, enroll, pull).
- **Tras pull ZK:** inserta en `alfa_biometric_punch` (ON CONFLICT DO NOTHING) y en `finger_punches` (cache/asistencia Alfa).
- ATT2016: solo herramientas avanzadas en Configuración; no es la UI diaria de Dispositivos.

## Env

```bash
ODOO_BIOMETRIC_DATABASE_URL=postgresql://odoo:***@odoo18_db:5432/syntradata
```

El contenedor `security_contracts_app` debe alcanzar `odoo18_db` (red Docker compartida `presupuestos-alfa_default`).

## Capacidades

| Acción | Notas |
|--------|--------|
| Listar relojes / marcas / usuarios | Preferente Odoo |
| Push / enroll | ZK; espejo local `finger_devices` por IP |
| Traer marcas | ZK → Odoo + finger_* |
| Historial UI | `/finger-system/marcas` |

## Nav Finger (slim)

Dashboard · Empleados · Dispositivos · Marcas · Asistencia · Turnos · Reportes · Configuración  
(Biometría / Backups / Mantenimiento / Auditoría → enlaces en Configuración)
