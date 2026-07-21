"use client";

import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";

interface PendingRow {
  id: string;
  code: string;
  title: string;
  documentType: { name: string };
  pendingVersion: {
    id: string;
    versionLabel: string;
    revisionDate: string;
    changeSummary: string | null;
    uploadedBy: { name: string };
    downloadUrl: string;
  } | null;
}

export default function SigAprobacionesPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["sig-pending"],
    queryFn: async () => {
      const r = await fetch("/api/sig/bitacora?pending=1", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar pendientes");
      return r.json() as Promise<{ data: { rows: PendingRow[] } }>;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ docId, versionId }: { docId: string; versionId: string }) => {
      const r = await fetch(`/api/sig/documents/${docId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
        credentials: "same-origin",
      });
      if (!r.ok) {
        const json = await r.json();
        throw new Error(json?.error?.message ?? "Error");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sig-pending"] }),
  });

  const rows = data?.data.rows ?? [];
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const pendingColumnDefs: TableColumnFilterDef<PendingRow>[] = [
    { key: "code", label: "Código", headerClassName: "px-3 py-2", getValue: (r) => r.code },
    { key: "title", label: "Título", headerClassName: "px-3 py-2", getValue: (r) => r.title },
    { key: "version", label: "Versión", headerClassName: "px-3 py-2", getValue: (r) => r.pendingVersion?.versionLabel ?? "" },
    { key: "uploader", label: "Subido por", headerClassName: "px-3 py-2", getValue: (r) => r.pendingVersion?.uploadedBy.name ?? "" },
    { key: "actions", label: "Acciones", headerClassName: "px-3 py-2", filterable: false, getValue: () => "" },
  ];
  const displayedRows = filterRowsByColumnFilters(rows, columnFilters, pendingColumnDefs);

  return (
    <>
      <Topbar title="SIG — Aprobaciones pendientes" />
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table data-table-id="sig-aprobaciones" className="w-full text-sm">
              <thead>
                <TableColumnFilterHead
                  tableId="sig-aprobaciones"
                  defaultColumnWidths={{
                    code: 120,
                    title: 220,
                    version: 90,
                    uploader: 160,
                    actions: 90,
                  }}
                  columns={pendingColumnDefs}
                  rows={rows}
                  filters={columnFilters}
                  onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                />
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Cargando…
                    </td>
                  </tr>
                )}
                {!isLoading && displayedRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No hay documentos pendientes de aprobación
                    </td>
                  </tr>
                )}
                {displayedRows.map((row) => {
                  const v = row.pendingVersion;
                  if (!v) return null;
                  return (
                    <tr key={row.id} className="border-b">
                      <td className="px-3 py-2 font-mono text-xs">{row.code}</td>
                      <td className="px-3 py-2">{row.title}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">v{v.versionLabel}</Badge>
                      </td>
                      <td className="px-3 py-2">{v.uploadedBy.name}</td>
                      <td className="px-3 py-2 flex flex-wrap gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={v.downloadUrl} target="_blank" rel="noreferrer">
                            Ver archivo
                          </a>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/sig/documentos/${row.id}`}>Detalle</Link>
                        </Button>
                        <Button
                          size="sm"
                          disabled={approveMutation.isPending}
                          onClick={() =>
                            approveMutation.mutate({ docId: row.id, versionId: v.id })
                          }
                        >
                          Aprobar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          Revisión: {formatDate(new Date().toISOString())} · Use la ficha del documento para rechazar con motivo.
        </p>
      </div>
    </>
  );
}
