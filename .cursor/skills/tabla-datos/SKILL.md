---
name: tabla-datos
description: Tablas de listados en Alfa One (filtros, Excel, sticky, columnas redimensionables). Usar al crear o editar tablas en src/app o src/components, listados, grids, export Excel.
---

# Tablas de datos (UI)

Aplica a todo listado tabular nuevo o editado en Alfa One.

## Checklist

1. **Filtros** al clic en título de columna — ocultos por defecto → `TableColumnFilterHead`
2. **Export Excel** → `exportRowsToExcel` (`src/lib/utils/excel-export.ts`) — **nunca** `import * as XLSX`
3. **Encabezado sticky** + scroll interno en listados largos
4. **Columnas redimensionables** — asa en borde del `<th>`, persistencia `localStorage`

## Identificador de tabla

```tsx
<table data-table-id="modulo-pantalla" className="w-full text-sm">
  <thead>
    <TableColumnFilterHead tableId="modulo-pantalla" /* ... */ />
  </thead>
</table>
```

Con `TableColumnFilterHead`, pasar `tableId` (+ opcional `defaultColumnWidths`).

## Evitar

```tsx
// ❌ Trunca datos que el usuario no puede recuperar
<span>{row.claveFactura.slice(-12)}</span>
<td className="max-w-[160px]"><span className="truncate">{row.claveFactura}</span></td>

// ✅ Mostrar valor completo + resize
<span className="whitespace-nowrap" title={row.claveFactura}>{row.claveFactura}</span>
```

Layout `(app)` monta `EnableTableColumnResize` globalmente.

Referencia: `src/components/ui/enable-table-column-resize.tsx`, `ResizableTh`, `FacturacionListFilters.tsx`.

Regla: `code/presupuestos-alfa/.cursor/rules/data-tables.mdc`
