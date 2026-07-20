"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import { useOpFiltros } from "@/components/naf-operaciones/use-op-filtros";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import {
  OP_DIA_SEMANA_LABELS,
  type OpAsistenciaRow,
} from "@/modules/naf-operaciones/business/op-types";

type ListData = {
  rows: OpAsistenciaRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  ano?: number;
  semana?: number;
};

export default function NafOperacionesAsistenciaPage() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session ?? null, "nafOperaciones.asistencia", "edit");
  const qc = useQueryClient();
  const filtros = useOpFiltros();

  const [noCiaGrupo, setNoCiaGrupo] = useState("");
  const [noContrato, setNoContrato] = useState("");
  const [propietario, setPropietario] = useState("");
  const [nombre, setNombre] = useState("");
  const [fecha, setFecha] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [ano, setAno] = useState("");
  const [semana, setSemana] = useState("");
  const [inconsistentesOnly, setInconsistentesOnly] = useState(false);
  const [applied, setApplied] = useState({
    noCiaGrupo: "",
    noContrato: "",
    propietario: "",
    nombre: "",
    fecha: "",
    fechaDesde: "",
    fechaHasta: "",
    ano: "",
    semana: "",
    inconsistentesOnly: false,
  });
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const current = filtros.data?.currentWeek;
  const hasFechaFiltro = Boolean(
    applied.fecha.trim() || applied.fechaDesde.trim() || applied.fechaHasta.trim(),
  );
  const effectiveAno =
    applied.ano || (!hasFechaFiltro && current ? String(current.ano) : "");
  const effectiveSemana =
    applied.semana || (!hasFechaFiltro && current ? String(current.semana) : "");

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (applied.noCiaGrupo) sp.set("noCiaGrupo", applied.noCiaGrupo);
    if (applied.noContrato) sp.set("noContrato", applied.noContrato);
    if (applied.propietario.trim()) sp.set("propietario", applied.propietario.trim());
    if (applied.nombre.trim()) sp.set("nombre", applied.nombre.trim());
    if (applied.fecha.trim()) sp.set("fecha", applied.fecha.trim());
    if (applied.fechaDesde.trim()) sp.set("fechaDesde", applied.fechaDesde.trim());
    if (applied.fechaHasta.trim()) sp.set("fechaHasta", applied.fechaHasta.trim());
    if (effectiveAno) sp.set("ano", effectiveAno);
    if (effectiveSemana) sp.set("semana", effectiveSemana);
    if (applied.inconsistentesOnly) sp.set("inconsistentesOnly", "1");
    return sp.toString();
  }, [applied, page, effectiveAno, effectiveSemana]);

  const query = useQuery({
    queryKey: ["naf-operaciones", "asistencias", queryParams],
    enabled: Boolean(hasFechaFiltro || (effectiveAno && effectiveSemana)),
    queryFn: async (): Promise<ListData> => {
      const res = await fetch(`/api/naf-operaciones/asistencias?${queryParams}`);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? "Error al listar asistencia OP");
      }
      const json = await res.json();
      return json.data as ListData;
    },
  });

  const marcaMutation = useMutation({
    mutationFn: async (payload: { row: OpAsistenciaRow; marca: "S" | "N" }) => {
      const { row, marca } = payload;
      const res = await fetch("/api/naf-operaciones/asistencias/marca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noCiaGrupo: row.noCiaGrupo,
          noRol: row.noRol,
          diaSemana: row.diaSemana,
          ano: row.ano,
          semana: row.semana,
          marca,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "No se pudo marcar asistencia");
      return json.data as { message: string | null };
    },
    onSuccess: (data) => {
      setErr(null);
      setMsg(data.message ?? "Marca guardada");
      qc.invalidateQueries({ queryKey: ["naf-operaciones", "asistencias"] });
    },
    onError: (e: Error) => {
      setMsg(null);
      setErr(e.message);
    },
  });

  return (
    <ModulePage wide>
      <ModulePageHeader
        title="Asistencia OP"
        description="Consulta y marca de asistencia diaria (AROPPR.IND_MARCA). Semana calendario AROPCA."
      />

      {!canEdit ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Puede consultar, pero no marcar: falta <code>nafOperaciones.asistencia</code> en modo
          edición.
        </p>
      ) : (
        <p className="text-sm text-gray-600">
          Use <strong>Marcar S</strong> / <strong>Quitar (N)</strong> en cada fila para registrar
          asistencia en Oracle.
        </p>
      )}

      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex min-w-[120px] flex-col gap-1 text-xs font-medium text-gray-600">
          Cia grupo
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={noCiaGrupo}
            onChange={(e) => setNoCiaGrupo(e.target.value)}
          >
            <option value="">Todas</option>
            {(filtros.data?.companies ?? []).map((c) => (
              <option key={c.noCiaGrupo} value={c.noCiaGrupo}>
                {c.noCiaGrupo}
              </option>
            ))}
          </select>
        </label>
        <label className="flex w-28 flex-col gap-1 text-xs font-medium text-gray-600">
          Año
          <Input
            value={ano}
            placeholder={current ? String(current.ano) : "AAAA"}
            onChange={(e) => setAno(e.target.value)}
          />
        </label>
        <label className="flex w-28 flex-col gap-1 text-xs font-medium text-gray-600">
          Semana
          <Input
            value={semana}
            placeholder={current ? String(current.semana) : "N"}
            onChange={(e) => setSemana(e.target.value)}
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-gray-600">
          Contrato
          <Input
            value={noContrato}
            onChange={(e) => setNoContrato(e.target.value)}
            placeholder="Contrato"
          />
        </label>
        <label className="flex min-w-[140px] flex-col gap-1 text-xs font-medium text-gray-600">
          Propietario
          <Input
            value={propietario}
            onChange={(e) => setPropietario(e.target.value)}
            placeholder="Nº empleado"
          />
        </label>
        <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Nombre empleado
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. PORRAS"
            onKeyDown={(e) => e.key === "Enter" && document.getElementById("op-asist-filtrar")?.click()}
          />
        </label>
        <label className="flex w-40 flex-col gap-1 text-xs font-medium text-gray-600">
          Fecha
          <Input
            type="date"
            value={fecha}
            onChange={(e) => {
              setFecha(e.target.value);
              if (e.target.value) {
                setFechaDesde("");
                setFechaHasta("");
              }
            }}
          />
        </label>
        <label className="flex w-40 flex-col gap-1 text-xs font-medium text-gray-600">
          Desde
          <Input
            type="date"
            value={fechaDesde}
            onChange={(e) => {
              setFechaDesde(e.target.value);
              if (e.target.value) setFecha("");
            }}
          />
        </label>
        <label className="flex w-40 flex-col gap-1 text-xs font-medium text-gray-600">
          Hasta
          <Input
            type="date"
            value={fechaHasta}
            onChange={(e) => {
              setFechaHasta(e.target.value);
              if (e.target.value) setFecha("");
            }}
          />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={inconsistentesOnly}
            onChange={(e) => setInconsistentesOnly(e.target.checked)}
          />
          Solo inconsistentes
        </label>
        <Button
          id="op-asist-filtrar"
          type="button"
          className="bg-red-600 hover:bg-red-700"
          onClick={() => {
            setPage(1);
            setApplied({
              noCiaGrupo,
              noContrato,
              propietario,
              nombre,
              fecha,
              fechaDesde,
              fechaHasta,
              ano,
              semana,
              inconsistentesOnly,
            });
          }}
        >
          Filtrar
        </Button>
      </div>

      {current ? (
        <p className="text-xs text-gray-500">
          Semana calendario actual: {current.ano}-W{current.semana}
          {current.fecha1 && current.fecha2 ? ` (${current.fecha1} → ${current.fecha2})` : ""}
        </p>
      ) : null}

      {query.isError ? (
        <p className="text-sm text-red-600">{(query.error as Error).message}</p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Rol</th>
              <th className="px-3 py-2">Día</th>
              <th className="px-3 py-2">Propietario</th>
              <th className="px-3 py-2">Marca</th>
              <th className="px-3 py-2">Estado</th>
              <th className="px-3 py-2">Horas</th>
              <th className="px-3 py-2">Contrato</th>
              {canEdit ? <th className="px-3 py-2">Acción</th> : null}
            </tr>
          </thead>
          <tbody>
            {(query.data?.rows ?? []).map((row) => {
              const key = `${row.noCiaGrupo}-${row.noRol}-${row.diaSemana}-${row.ano}-${row.semana}`;
              const dia = OP_DIA_SEMANA_LABELS[row.diaSemana] ?? row.diaSemana;
              const href =
                row.propietario && row.noCiaGrupo
                  ? `/empleados-naf/${row.noCiaGrupo}-${row.propietario}`
                  : null;
              const busy =
                marcaMutation.isPending &&
                marcaMutation.variables?.row.noRol === row.noRol &&
                marcaMutation.variables?.row.diaSemana === row.diaSemana;
              return (
                <tr key={key} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{row.dia ?? "—"}</td>
                  <td className="px-3 py-2 font-mono">{row.noRol}</td>
                  <td className="px-3 py-2">{dia}</td>
                  <td className="px-3 py-2">
                    {href ? (
                      <Link href={href} className="text-red-700 hover:underline">
                        {row.nombrePropietario ?? row.propietario}
                      </Link>
                    ) : (
                      row.propietario ?? "—"
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {row.indInconsistencia === "S" ? (
                      <Badge variant="destructive">Inc.</Badge>
                    ) : row.indMarca === "S" ? (
                      <Badge className="bg-emerald-600 hover:bg-emerald-600">S</Badge>
                    ) : (
                      <Badge variant="secondary">{row.indMarca ?? "N"}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">{row.indEstado ?? row.estadoRol ?? "—"}</td>
                  <td className="px-3 py-2">{row.horas ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.noContrato ?? "—"}</td>
                  {canEdit ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 bg-emerald-600 px-2 hover:bg-emerald-700"
                          disabled={busy || row.indMarca === "S"}
                          onClick={() => marcaMutation.mutate({ row, marca: "S" })}
                        >
                          Marcar S
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 px-2"
                          disabled={busy || row.indMarca === "N"}
                          onClick={() => marcaMutation.mutate({ row, marca: "N" })}
                        >
                          Quitar
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
            {!query.isLoading && (query.data?.rows.length ?? 0) === 0 ? (
              <tr>
                <td colSpan={canEdit ? 9 : 8} className="px-3 py-8 text-center text-gray-500">
                  Sin asistencia para la semana seleccionada.
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
            : `${query.data?.total ?? 0} registros · ${query.data?.ano ?? effectiveAno}-W${query.data?.semana ?? effectiveSemana}`}
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
