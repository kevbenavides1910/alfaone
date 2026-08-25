# Finger System

Módulo de **asistencia biométrica** integrado en Alfa One para el rol Planillas.

## Rutas UI

- `/finger-system` — Dashboard
- `/finger-system/empresas`, `/empleados`, `/biometria`, `/dispositivos`
- `/finger-system/marcas-en-vivo`, `/asistencia`, `/turnos`, `/reportes`
- `/finger-system/backups`, `/mantenimiento`, `/auditoria`, `/configuracion`

## APIs

- `GET /api/finger-system/dashboard`
- `GET /api/finger-system/diagnostic`
- `GET /api/finger-system/settings`

## Código

| Capa | Ubicación |
|------|-----------|
| Servicios | `src/modules/finger-system/services/` |
| Integración ATT2016 | `src/modules/finger-system/integrations/att2016/` |
| Adaptadores biométricos | `src/modules/finger-system/integrations/biometric/` |
| UI | `src/components/finger-system/` |
| Páginas | `src/app/(app)/finger-system/` |

## Permisos

Claves `fingerSystem.*` en `src/lib/permissions/registry.ts`.

## Documentación

Ver `docs/finger-system/README.md`.
