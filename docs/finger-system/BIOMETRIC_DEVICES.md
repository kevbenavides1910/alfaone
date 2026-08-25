# BIOMETRIC_DEVICES.md

## Capas

```
BiometricDeviceInterface (types.ts)
  └── ZKTecoAdapter (futuro, TCP 4370)
  └── OtherBiometricAdapter (futuro)

BiometricService (orquestación, futuro)
FingerSyncService (worker, futuro)
```

## Modelo Finger System (`finger_devices`)

Campos principales: nombre, IP, puerto, marca, modelo, empresa, ubicación, estado, última sync.

## Descubrimiento de red

- Rango IP configurable desde `app_finger_settings.discoveryDefaultPort` (default 4370)
- UI en `/finger-system/dispositivos` (Fase 4)

## Estado en tiempo real

| Estado | Significado |
|--------|-------------|
| ONLINE | Responde al ping/protocolo |
| OFFLINE | Sin respuesta |
| ERROR | Respuesta con error |
| UNKNOWN | Sin verificar aún |

## Seguridad

- Credenciales de dispositivos **nunca** en código fuente
- Usar variables de entorno o secretos del servidor
