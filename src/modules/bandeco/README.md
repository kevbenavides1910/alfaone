# Módulo Bandeco — Monitoreo de alarmas

Réplica del Excel **Sistema de Alarmas Bandeco** en la plataforma Alfa One.

## Pantallas operativas

| Ruta | Equivalente Excel |
|------|-------------------|
| `/bandeco` | CONSULTA — búsqueda por código y mensajes WhatsApp |
| `/bandeco/activaciones` | ACTIVACIONES — registro e informe |
| `/bandeco/registro` | REGISTRO — historial |
| `/bandeco/aperturas-cierres` | A Y C / APEYCE |
| `/bandeco/eventos` | EVENTOS / GENERARBITACORA |
| `/bandeco/pilas` | PILAS |
| `/bandeco/informe-semanal` | INFORME SEMANAL |

## Mantenimientos editables (`/bandeco/mantenimientos`)

| Pestaña | Hoja Excel |
|---------|------------|
| Códigos de alarma | BASE_DATOS / DATOS |
| Pantallas | PANTALLAS |
| Puestos | PUESTOS |
| Cámaras | CAMARAS |
| Cuentas apertura | APERTURAS |
| Pilas por finca | PILAS |

## Importación inicial

```bash
npm run db:migrate
npm run db:import-bandeco -- "cargas/Sistema de Alarmas Bandeco BETA 1.1.2 (1).xlsm"
```

También se puede subir el `.xlsm` desde **Mantenimientos → Importar Excel**.

## Permisos

- `bandeco.consulta` — consulta de códigos
- `bandeco.operacion` — activaciones, aperturas, eventos, pilas
- `bandeco.registros` — historial e informe semanal
- `bandeco.mantenimientos` — catálogos e importación
