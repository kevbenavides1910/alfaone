"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import {
  DEFAULT_OP_FILTERS,
  OpFiltersBar,
  type OpFilterState,
} from "@/components/naf-operaciones/OpFiltersBar";
import {
  OP_DIA_SEMANA_LABELS,
  type OpVacanteRow,
} from "@/modules/naf-operaciones/business/op-types";

type ListData = {
  rows: OpVacanteRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export default function NafOperacionesVacantesPage() {
  const [filters, setFilters] = useState<OpFilterState>({
    ...DEFAULT_OP_FILTERS,
    estado: "*",
  });
  const [applied, setApplied] = useState<OpFilterState>({
    ...DEFAULT_OP_FILTERS,
    estado: "*",
  });
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("kind", "vacantes");
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (applied.noCiaGrupo) sp.set("noCiaGrupo", applied.noCiaGrupo);
    if (applied.noContrato) sp.set("noContrato", applied.noContrato);
    if (applied.noUbicacion) sp.set("noUbicacion", applied.noUbicacion);
    if (applied.semanaPgr.trim() !== "") sp.set("semanaPgr", applied.semanaPgr.trim());
    return sp.toString();
  }, [applied, page]);

  const query = useQuery({
    queryKey: ["naf-operaciones", "vacantes", queryParams],
    queryFn: async (): Promise<ListData> => {
      const res = await fetch(`/api/naf-operaciones/filtros?${queryParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Error al listar vacantes OP");
      }
      const json = await res.json();
      return json.data as ListData;
    },
  });

  return (
    <ModulePage wide>
      <ModulePageHeader
        title="Vacantes OP"
        description="Roles activos en AROPMR sin asignación vigente en AROPCP."
      />

      <OpFiltersBar
        value={filters}
        onChange={setFilters}
        onSearch={() => {
          setPage(1);
          setApplied(filters);
        }}
        showQ={false}
        showEstado={false}
      />

      {query.isError ? (
        <p className="text-sm text-red-600">{(query.error as Error).message}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Cia</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Día</th>
              <th className="px-3 py-2">Contrato</th>
              <th className="px-3 py-2">Ubicación</th>
              <th className="px-3 py-2">Sem PGR</th>
              <th className="px-3 py-2">Horario</th>
              <th className="px-3 py-2">Perfil</th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((row) => {
              const key = `${row.noCiaGrupo}-${row.noContrato}-${row.noUbicacion}-${row.noRol}-${row.semanaPgr}-${row.diaSemana}`;
              return (
                <tr key={key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{row.noCiaGrupo}</td>
                  <td className="px-3 py-2 font-mono">{row.noRol}</td>
                  <td className="px-3 py-2">{OP_DIA_SEMANA_LABELS[row.diaSemana] ?? row.diaSemana}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.noContrato}</td>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs">{row.noUbicacion}</div>
                    {row.ubicacionNombre ? (
                      <div className="text-xs text-gray-500">{row.ubicacionNombre}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-center">{row.semanaPgr}</td>
                  <td className="px-3 py-2 text-xs">
                    {[row.inicio, row.fin].filter(Boolean).join(" – ") || "—"}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline">{row.perfil ?? "—"}</Badge>
                  </td>
                </tr>
              );
            })}
            {!query.isLoading && (query.data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                  No hay vacantes con los filtros actuales.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
        <span>
          {query.isLoading ? "Cargando…" : `${query.data?.total ?? 0} vacantes`}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={query.data != null && page >= query.data.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </ModulePage>
  );
}
