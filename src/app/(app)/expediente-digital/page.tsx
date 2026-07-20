"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { FileSpreadsheet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import {
  TableColumnFilterHead,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";
import { exportRowsToExcel } from "@/lib/utils/excel-export";
import type { ExpedienteCandidato } from "@/modules/expediente-digital/business/types";

export default function ExpedienteDigitalPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  const searchQuery = useQuery({
    queryKey: ["expediente-digital", "search", appliedQ],
    enabled: appliedQ.trim().length >= 2,
    queryFn: async (): Promise<ExpedienteCandidato[]> => {
      const sp = new URLSearchParams({ q: appliedQ.trim() });
      const res = await fetch(`/api/expediente-digital/search?${sp}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error en la búsqueda");
      return (json.data?.candidates ?? []) as ExpedienteCandidato[];
    },
  });

  const autoOpen = useMutation({
    mutationFn: async (term: string) => {
      const sp = new URLSearchParams({ q: term });
      const res = await fetch(`/api/expediente-digital/search?${sp}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error en la búsqueda");
      return (json.data?.candidates ?? []) as ExpedienteCandidato[];
    },
    onSuccess: (candidates, term) => {
      setAppliedQ(term);
      if (candidates.length === 1) {
        router.push(`/expediente-digital/${encodeURIComponent(candidates[0].cedula)}`);
      }
    },
  });

  const rows = searchQuery.data ?? [];
  const columnDefs: TableColumnFilterDef<ExpedienteCandidato>[] = [
    {
      key: "nombre",
      label: "Nombre",
      headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
      getValue: (r) => r.nombre,
    },
    {
      key: "cedula",
      label: "Cédula",
      headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
      getValue: (r) => r.cedula,
    },
    {
      key: "codigo",
      label: "Código",
      headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
      getValue: (r) => r.noEmplePreferido ?? "",
    },
    {
      key: "cia",
      label: "Cía",
      headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
      getValue: (r) => r.noCiaPreferida ?? "",
    },
    {
      key: "estado",
      label: "Estado",
      headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
      getValue: (r) => r.estado ?? "",
    },
    {
      key: "empleos",
      label: "Empleos",
      headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2 font-semibold text-gray-700",
      getValue: (r) => String(r.empleosCount),
    },
    {
      key: "actions",
      label: "",
      filterable: false,
      headerClassName: "sticky top-0 z-10 bg-gray-50 px-3 py-2",
      getValue: () => "",
    },
  ];
  const displayed = filterRowsByColumnFilters(rows, columnFilters, columnDefs);

  return (
    <ModulePage wide>
      <ModulePageHeader
        title="Expediente digital"
        description="Consulta documentos NAF por cédula o nombre. Acumula todos los códigos de empleado de la misma persona."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Nombre, código o cédula
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej. MORALES, 099396 o 1-0963-0382"
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim().length >= 2) {
                autoOpen.mutate(q.trim());
              }
            }}
          />
        </label>
        <Button
          type="button"
          className="bg-red-600 hover:bg-red-700"
          disabled={q.trim().length < 2 || autoOpen.isPending}
          onClick={() => autoOpen.mutate(q.trim())}
        >
          Buscar
        </Button>
        {displayed.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            className="gap-2"
            onClick={() =>
              exportRowsToExcel({
                filename: "expediente-digital-busqueda",
                sheetName: "Personas",
                rows: displayed.map((r) => ({
                  Nombre: r.nombre,
                  Cedula: r.cedula,
                  Codigo: r.noEmplePreferido ?? "",
                  Cia: r.noCiaPreferida ?? "",
                  Estado: r.estado ?? "",
                  Empleos: r.empleosCount,
                })),
                columnWidths: [36, 16, 12, 8, 10, 10],
              })
            }
          >
            <FileSpreadsheet className="h-4 w-4" />
            Excel
          </Button>
        ) : null}
      </div>

      {autoOpen.isError ? (
        <p className="text-sm text-red-600">{(autoOpen.error as Error).message}</p>
      ) : null}
      {searchQuery.isError ? (
        <p className="text-sm text-red-600">{(searchQuery.error as Error).message}</p>
      ) : null}

      {appliedQ && !searchQuery.isLoading && displayed.length === 0 && !searchQuery.isError ? (
        <p className="text-sm text-gray-500">Sin resultados para «{appliedQ}».</p>
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="max-h-[min(70vh,720px)] overflow-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <TableColumnFilterHead
                  columns={columnDefs}
                  rows={rows}
                  filters={columnFilters}
                  onFilterChange={(k, v) => setColumnFilters((s) => ({ ...s, [k]: v }))}
                />
              </thead>
              <tbody>
                {displayed.map((r) => (
                  <tr key={r.cedula} className="border-t border-gray-100 hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium text-gray-900">{r.nombre}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">{r.cedula}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">
                      {r.noEmplePreferido ?? "—"}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-700">
                      {r.noCiaPreferida ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      {r.estado ? (
                        <Badge variant={r.estado === "A" ? "default" : "secondary"}>
                          {r.estado}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{r.empleosCount}</td>
                    <td className="px-3 py-2 text-right">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/expediente-digital/${encodeURIComponent(r.cedula)}`}>
                          Abrir
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {searchQuery.isLoading || autoOpen.isPending ? (
        <p className="text-sm text-gray-500">Buscando…</p>
      ) : null}
    </ModulePage>
  );
}
