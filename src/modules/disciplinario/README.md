# Módulo: Disciplinario

## Responsabilidad

Importación de lotes, apercibimientos, tratamientos por empleado, PDFs, omisiones, configuración SMTP/firma.

## Rutas UI

- `/disciplinario/importar`, `/dashboard`, `/empleados`, `/proceso`, `/reportes/omisiones`, `/ajustes/**`

## APIs

- `/api/disciplinary/**`
- `/api/admin/disciplinary/**`

## Código (Fase 2 — migrado)

| Capa | Ubicación |
|------|-----------|
| Reglas de negocio | `src/modules/disciplinario/business/` |
| Servicios (PDF, import, SMTP, etc.) | `src/modules/disciplinario/services/` |
| Barrel opcional | `src/modules/disciplinario/index.ts` |
| Páginas | `src/app/(app)/disciplinario` |
| Componentes | `src/components/disciplinary` |

### Business

- `disciplinary.ts` — vigencia, códigos empleado, licitación
- `disciplinary-zone-key.ts` — normalización de zonas
- `disciplinary-punto-omitido.ts` — punto omitido en import marcas

### Services

- `disciplinary-import.ts` — import workbook legacy
- `disciplinary-marcas-import.ts` — import marcas + email
- `disciplinary-settings.ts` — configuración documento y numeración
- `disciplinary-omision-pdf.ts`, `disciplinary-pdf-logo.ts`, `disciplinary-merge-pdfs.ts`
- `disciplinary-bulk-zone-pdf.ts`, `disciplinary-email.ts`, `disciplinary-smtp.ts`
- `disciplinary-zone-defaults.ts`, `disciplinary-employees-csv.ts`

## Imports

```ts
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import { ensureDisciplinarySettingsRow } from "@/modules/disciplinario/services/disciplinary-settings";
```

## Próximo paso opcional

Mover `src/components/disciplinary` → `src/modules/disciplinario/components` (solo organización; sin cambio de URLs).
