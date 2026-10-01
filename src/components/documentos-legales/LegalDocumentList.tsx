"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { legalDocumentTypeMeta } from "@/modules/documentos-legales/business/catalog";
import type { LegalDocumentDto } from "@/modules/documentos-legales/business/dto";
import { formatReminderList } from "@/modules/documentos-legales/business/reminders";
import { companyDisplayName } from "@/lib/utils/constants";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { Button } from "@/components/ui/button";
import { TableColumnFilterHead, type TableColumnFilterDef } from "@/components/ui/table-column-filters";

export function LegalDocumentList({
  month,
  documents,
  companies,
  onOpen,
}: {
  month: string;
  documents: LegalDocumentDto[];
  companies: { code: string; name: string }[];
  onOpen: (doc: LegalDocumentDto) => void;
}) {
  const [filters, setFilters] = useState<Record<string, string>>({});
  const columns = useMemo((): TableColumnFilterDef<LegalDocumentDto>[] => [
    { key: "dueDate", label: "Fecha", getValue: (row) => formatDate(row.dueDate) },
    { key: "type", label: "Tipo", getValue: (row) => row.typeLabel },
    { key: "description", label: "Descripción", getValue: (row) => row.description },
    { key: "amount", label: "Monto", align: "right", getValue: (row) => row.amount, formatValue: (value) => formatCurrency(Number(value)) },
    {
      key: "company",
      label: "Empresa",
      getValue: (row) => (row.company ? companyDisplayName(row.company, companies) : ""),
    },
    { key: "reference", label: "Referencia", getValue: (row) => row.referenceNumber ?? "" },
    { key: "responsible", label: "Responsable", getValue: (row) => row.responsibleName },
    { key: "reminders", label: "Recordatorios", getValue: (row) => formatReminderList(row.reminders) },
    { key: "paid", label: "Estado", getValue: (row) => (row.paid ? "Pagado" : "Pendiente") },
  ], [companies]);

  const rows = useMemo(
    () => filterRowsByColumnFilters(documents, filters, columns),
    [documents, filters, columns],
  );

  function exportExcel() {
    exportRowsToExcel({
      filename: `documentos-legales-${month}`,
      sheetName: "Documentos",
      rows: rows.map((row) => ({
        Fecha: row.dueDate,
        Tipo: row.typeLabel,
        Descripción: row.description,
        Monto: row.amount,
        Empresa: row.company ? companyDisplayName(row.company, companies) : "",
        Referencia: row.referenceNumber ?? "",
        Responsable: row.responsibleName,
        Correo: row.responsibleEmail,
        Recordatorios: formatReminderList(row.reminders),
        Estado: row.paid ? "Pagado" : "Pendiente",
        Notas: row.notes ?? "",
      })),
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={exportExcel} disabled={rows.length === 0}>
          <Download className="mr-1 h-4 w-4" /> Excel
        </Button>
      </div>
      <div className="max-h-[70vh] overflow-auto rounded-md border">
        <table data-table-id="documentos-legales-listado" className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <TableColumnFilterHead
              tableId="documentos-legales-listado"
              columns={columns}
              rows={documents}
              filters={filters}
              onFilterChange={(key, value) => setFilters((current) => ({ ...current, [key]: value }))}
              headerRowClassName="bg-card"
            />
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-muted-foreground">
                  No hay documentos para este mes.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const meta = legalDocumentTypeMeta(row.type);
                return (
                  <tr key={row.id} className="border-t hover:bg-muted/40">
                    <td className="whitespace-nowrap px-2 py-1.5">{formatDate(row.dueDate)}</td>
                    <td className="px-2 py-1.5">
                      <span className={`rounded border px-1.5 text-xs ${meta.chip}`}>{row.typeLabel}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      <button type="button" className="text-left hover:underline" onClick={() => onOpen(row)}>
                        <span className="whitespace-nowrap" title={row.description}>{row.description}</span>
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right">{formatCurrency(row.amount)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">
                      {row.company ? companyDisplayName(row.company, companies) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5" title={row.referenceNumber ?? ""}>
                      {row.referenceNumber || "—"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5">{row.responsibleName}</td>
                    <td className="px-2 py-1.5">{formatReminderList(row.reminders)}</td>
                    <td className="whitespace-nowrap px-2 py-1.5">{row.paid ? "Pagado" : "Pendiente"}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
