"use client";

import Link from "next/link";
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
  OP_ESTADO_LABELS,
  type OpRoleRow,
} from "@/modules/naf-operaciones/business/op-types";

type ListResponse = {
  data: {
    rows: OpRoleRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export default function NafOperacionesRolesPage() {
  const [filters, setFilters] = useState<OpFilterState>(DEFAULT_OP_FILTERS);
  const [applied, setApplied] = useState<OpFilterState>(DEFAULT_OP_FILTERS);
  const [page, setPage] = useState(1);

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (applied.q.trim()) sp.set("q", applied.q.trim());
    if (applied.noCiaGrupo) sp.set("noCiaGrupo", applied.noCiaGrupo);
    if (applied.noContrato) sp.set("noContrato", applied.noContrato);
    if (applied.noUbicacion) sp.set("noUbicacion", applied.noUbicacion);
    if (applied.semanaPgr.trim() !== "") sp.set("semanaPgr", applied.semanaPgr.trim());
    if (applied.estado === "*") sp.set("estado", "*");
    else if (applied.estado) sp.set("estado", applied.estado);
    return sp.toString();
  }, [applied, page]);

  const query = useQuery({
    queryKey: ["naf-operaciones", "roles", queryParams],
    queryFn: async (): Promise<ListResponse["data"]> => {
      const res = await fetch(`/api/naf-operaciones/roles?${queryParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Error al listar roles OP");
      }
      const json = (await res.json()) as ListResponse;
      return json.data;
    },
  });

  return (
    <ModulePage wide>
      <ModulePageHeader
        title="Operaciones NAF — Roles"
        description="Consulta de plantillas AROPMR. Para crear o editar roles use Programación."
        actions={
          <a
            href="/naf-operaciones/programacion"
            className="inline-flex h-10 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
          >
            Crear / programar roles
          </a>
        }
      />

      <OpFiltersBar
        value={filters}
        onChange={setFilters}
        onSearch={() => {
          setPage(1);
          setApplied(filters);
        }}
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
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Asignado</th>
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((row) => {
              const key = `${row.noCiaGrupo}-${row.noContrato}-${row.noUbicacion}-${row.noRol}-${row.semanaPgr}-${row.diaSemana}`;
              const dia = OP_DIA_SEMANA_LABELS[row.diaSemana] ?? row.diaSemana;
              const estado = row.estado
                ? OP_ESTADO_LABELS[row.estado] ?? row.estado
                : "—";
              const empleHref =
                row.noCia && row.noEmple
                  ? `/empleados-naf/${row.noCia}-${row.noEmple}`
                  : null;
              return (
                <tr key={key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{row.noCiaGrupo}</td>
                  <td className="px-3 py-2 font-mono">{row.noRol}</td>
                  <td className="px-3 py-2">{dia}</td>
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
                    {row.horas != null ? ` (${row.horas}h)` : ""}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={row.estado === "A" ? "default" : "secondary"}>{estado}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    {empleHref ? (
                      <Link href={empleHref} className="text-red-700 hover:underline">
                        {row.nombreEmpleado ?? `${row.noCia}-${row.noEmple}`}
                      </Link>
                    ) : (
                      <span className="text-gray-400">Sin asignar</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!query.isLoading && (query.data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                  Sin roles para los filtros actuales.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 text-sm text-gray-600">
        <span>
          {query.isLoading
            ? "Cargando…"
            : `${query.data?.total ?? 0} roles · pág. ${query.data?.page ?? page} / ${query.data?.totalPages ?? 1}`}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1 || query.isLoading}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={
              query.isLoading || (query.data != null && page >= query.data.totalPages)
            }
            onClick={() => setPage((p) => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </ModulePage>
  );
}
