"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import type {
  VacacionesCandidato,
  VacacionesConsulta,
  VacacionesMovimientoDetalle,
} from "@/modules/empleados-naf/business/vacaciones-types";

type DetalleKind = "disfrutados" | "incapacidades";

type DetalleModal = {
  kind: DetalleKind;
  periodo: number | null;
};

function ClickableMetric({
  label,
  value,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  value: number | string;
  hint?: string;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick) && !disabled;
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={onClick}
      className={`rounded-lg border border-gray-200 bg-white p-4 text-left transition-colors ${
        interactive
          ? "cursor-pointer hover:border-red-300 hover:bg-red-50/40 focus:outline-none focus:ring-2 focus:ring-red-500/30"
          : "cursor-default"
      }`}
    >
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div
        className={`text-2xl font-semibold ${
          interactive ? "text-red-700 underline-offset-2 hover:underline" : ""
        }`}
      >
        {value}
      </div>
      {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
      {interactive ? (
        <div className="mt-1 text-[11px] font-medium text-red-600">Ver detalle</div>
      ) : null}
    </button>
  );
}

function ClickableCell({
  value,
  disabled,
  onClick,
}: {
  value: number;
  disabled?: boolean;
  onClick?: () => void;
}) {
  const interactive = Boolean(onClick) && !disabled && value > 0;
  if (!interactive) {
    return <span>{value}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-medium text-red-700 underline-offset-2 hover:underline focus:outline-none"
      title="Ver detalle"
    >
      {value}
    </button>
  );
}

function MovimientosTable({ rows }: { rows: VacacionesMovimientoDetalle[] }) {
  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm text-gray-500">Sin movimientos para mostrar.</p>
    );
  }
  return (
    <div className="max-h-[min(60vh,520px)] overflow-auto rounded-md border border-gray-200">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 bg-gray-50 text-left text-xs uppercase text-gray-500">
          <tr>
            <th className="px-3 py-2">Nº acción</th>
            <th className="px-3 py-2">Nº transacción</th>
            <th className="px-3 py-2">Inicio</th>
            <th className="px-3 py-2">Fin</th>
            <th className="px-3 py-2">Días</th>
            <th className="px-3 py-2">Período</th>
            <th className="px-3 py-2">Tipo</th>
            <th className="px-3 py-2">Cia / Empleado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={`${r.noAccion ?? "x"}-${r.noTransaccion ?? "t"}-${i}`}
              className="border-t border-gray-100"
            >
              <td className="px-3 py-2 font-mono text-xs">{r.noAccion ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.noTransaccion ?? "—"}</td>
              <td className="px-3 py-2 text-xs">{r.fInicio ?? "—"}</td>
              <td className="px-3 py-2 text-xs">{r.fConclu ?? "—"}</td>
              <td className="px-3 py-2">{r.dias}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.periodo ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.tipoA ?? "—"}</td>
              <td className="px-3 py-2 font-mono text-xs">
                {r.noCia}-{r.noEmple}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VacacionesPersonalPage() {
  const [q, setQ] = useState("");
  const [appliedQ, setAppliedQ] = useState("");
  const [cedula, setCedula] = useState<string | null>(null);
  const [modal, setModal] = useState<DetalleModal | null>(null);

  const searchQuery = useQuery({
    queryKey: ["empleados-naf", "vacaciones-personal", "search", appliedQ],
    enabled: appliedQ.trim().length >= 2 && !cedula,
    queryFn: async (): Promise<VacacionesCandidato[]> => {
      const sp = new URLSearchParams({ q: appliedQ.trim() });
      const res = await fetch(`/api/empleados-naf/vacaciones-personal?${sp}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error en la búsqueda");
      return (json.data?.candidates ?? []) as VacacionesCandidato[];
    },
  });

  const detailQuery = useQuery({
    queryKey: ["empleados-naf", "vacaciones-personal", "detail", cedula],
    enabled: Boolean(cedula),
    queryFn: async (): Promise<VacacionesConsulta> => {
      const sp = new URLSearchParams({ cedula: cedula! });
      const res = await fetch(`/api/empleados-naf/vacaciones-personal?${sp}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error al cargar detalle");
      return json.data as VacacionesConsulta;
    },
  });

  const openDetail = (c: VacacionesCandidato) => {
    setCedula(c.cedula);
    setModal(null);
  };

  const autoOpen = useMutation({
    mutationFn: async (term: string) => {
      const sp = new URLSearchParams({ q: term });
      const res = await fetch(`/api/empleados-naf/vacaciones-personal?${sp}`);
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error?.message ?? "Error en la búsqueda");
      return (json.data?.candidates ?? []) as VacacionesCandidato[];
    },
    onSuccess: (candidates, term) => {
      setAppliedQ(term);
      if (candidates.length === 1) {
        setCedula(candidates[0].cedula);
      } else {
        setCedula(null);
      }
      setModal(null);
    },
  });

  const detail = detailQuery.data;

  const modalRows = useMemo(() => {
    if (!detail || !modal) return [];
    const source =
      modal.kind === "disfrutados" ? detail.detalleDisfrutados : detail.detalleIncapacidades;
    if (modal.periodo == null) return source;
    return source.filter((r) => r.periodo === modal.periodo);
  }, [detail, modal]);

  const modalTitle =
    modal?.kind === "disfrutados"
      ? modal.periodo != null
        ? `Días disfrutados · período ${modal.periodo}`
        : "Días disfrutados"
      : modal?.periodo != null
        ? `Incapacidades · período ${modal.periodo}`
        : "Incapacidades";

  return (
    <ModulePage wide>
      <ModulePageHeader
        title="Vacaciones de personal"
        description="Consulta por nombre, código o cédula. Consolida todas las compañías desde el ingreso actual; una baja 011 corta el historial."
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-white p-4">
        <label className="flex min-w-[260px] flex-1 flex-col gap-1 text-xs font-medium text-gray-600">
          Nombre, código o cédula
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej. MORALES, 099396 o 109630382"
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
        {cedula ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setCedula(null);
              setModal(null);
            }}
          >
            Volver a resultados
          </Button>
        ) : null}
      </div>

      {autoOpen.isError ? (
        <p className="text-sm text-red-600">{(autoOpen.error as Error).message}</p>
      ) : null}
      {searchQuery.isError ? (
        <p className="text-sm text-red-600">{(searchQuery.error as Error).message}</p>
      ) : null}
      {detailQuery.isError ? (
        <p className="text-sm text-red-600">{(detailQuery.error as Error).message}</p>
      ) : null}

      {!cedula ? (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2">Cédula</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Cia</th>
                <th className="px-3 py-2">Ingreso</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Empleos</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {(searchQuery.data ?? autoOpen.data ?? []).map((c) => (
                <tr key={c.cedula} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{c.cedula}</td>
                  <td className="px-3 py-2">{c.nombre}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.noEmplePreferido ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.noCiaPreferida ?? "—"}</td>
                  <td className="px-3 py-2 text-xs">{c.fechaIngreso ?? "—"}</td>
                  <td className="px-3 py-2">
                    <Badge variant={c.estado === "A" ? "default" : "secondary"}>
                      {c.estado ?? "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-center">{c.empleosCount}</td>
                  <td className="px-3 py-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => openDetail(c)}>
                      Ver vacaciones
                    </Button>
                  </td>
                </tr>
              ))}
              {appliedQ &&
              !searchQuery.isLoading &&
              !autoOpen.isPending &&
              ((searchQuery.data ?? autoOpen.data)?.length ?? 0) === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Sin resultados para “{appliedQ}”.
                  </td>
                </tr>
              ) : null}
              {!appliedQ ? (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-500">
                    Busque por nombre, código de empleado o número de cédula.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {cedula && detailQuery.isLoading ? (
        <p className="text-sm text-gray-500">Cargando vacaciones…</p>
      ) : null}

      {cedula && detail ? (
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{detail.nombre}</h2>
                <p className="text-sm text-gray-600">
                  Cédula <span className="font-mono">{detail.cedula}</span>
                </p>
              </div>
              <div className="text-right text-sm">
                <div className="text-xs uppercase text-gray-500">Fecha de ingreso (segmento)</div>
                <div className="text-lg font-semibold text-gray-900">
                  {detail.fechaIngreso ?? "—"}
                </div>
                {detail.empleoVacaciones ? (
                  <div className="mt-1 text-xs text-gray-500">
                    Libro vacaciones: {detail.empleoVacaciones.noCia}-
                    {detail.empleoVacaciones.noEmple}
                  </div>
                ) : null}
                {detail.ultimaBaja011 ? (
                  <div className="mt-1 text-xs text-amber-700">
                    Última baja 011: {detail.ultimaBaja011}
                  </div>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-500">{detail.notaSegmento}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs uppercase text-gray-500">Días generados</div>
              <div className="text-2xl font-semibold">{detail.totales.diasGanados}</div>
            </div>
            <ClickableMetric
              label="Días disfrutados"
              value={detail.totales.diasDisfrutados}
              disabled={
                detail.totales.diasDisfrutados <= 0 && detail.detalleDisfrutados.length === 0
              }
              onClick={() => setModal({ kind: "disfrutados", periodo: null })}
            />
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="text-xs uppercase text-gray-500">Saldo</div>
              <div className="text-2xl font-semibold text-red-700">{detail.totales.saldo}</div>
            </div>
            <ClickableMetric
              label="Días incapacidad"
              value={detail.totales.diasIncapacidad}
              hint={`${detail.totales.incapacidadAcciones} acción(es)`}
              disabled={
                detail.totales.diasIncapacidad <= 0 && detail.detalleIncapacidades.length === 0
              }
              onClick={() => setModal({ kind: "incapacidades", periodo: null })}
            />
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium">
              Detalle por período de vacaciones
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Período</th>
                  <th className="px-3 py-2">Generados</th>
                  <th className="px-3 py-2">Disfrutados</th>
                  <th className="px-3 py-2">Incapacidad</th>
                  <th className="px-3 py-2">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {detail.periodos.map((p) => (
                  <tr key={p.periodo} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono">{p.periodo}</td>
                    <td className="px-3 py-2">{p.diasGanados}</td>
                    <td className="px-3 py-2">
                      <ClickableCell
                        value={p.diasDisfrutados}
                        onClick={() => setModal({ kind: "disfrutados", periodo: p.periodo })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <ClickableCell
                        value={p.diasIncapacidad}
                        onClick={() => setModal({ kind: "incapacidades", periodo: p.periodo })}
                      />
                    </td>
                    <td className="px-3 py-2 font-medium">{p.saldo}</td>
                  </tr>
                ))}
                {detail.periodos.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                      Sin movimientos de vacaciones en el segmento actual.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium">
              Empleos ligados a la cédula (todas las compañías)
            </div>
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-3 py-2">Cia</th>
                  <th className="px-3 py-2">Código</th>
                  <th className="px-3 py-2">Ingreso</th>
                  <th className="px-3 py-2">Egreso</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">NAF</th>
                </tr>
              </thead>
              <tbody>
                {detail.empleos.map((e) => (
                  <tr key={`${e.noCia}-${e.noEmple}`} className="border-t border-gray-100">
                    <td className="px-3 py-2 font-mono text-xs">{e.noCia}</td>
                    <td className="px-3 py-2 font-mono text-xs">{e.noEmple}</td>
                    <td className="px-3 py-2 text-xs">{e.fIngreso ?? "—"}</td>
                    <td className="px-3 py-2 text-xs">{e.fEgreso ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge variant={e.estado === "A" ? "default" : "secondary"}>
                        {e.estado ?? "—"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/empleados-naf/${e.noCia}-${e.noEmple}`}
                        className="text-red-700 hover:underline"
                      >
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {detail.bajasHistoricas.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <div className="font-medium">Bajas 011 registradas</div>
              <ul className="mt-2 list-disc pl-5 text-xs">
                {detail.bajasHistoricas.map((b, i) => (
                  <li key={`${b.noCia}-${b.noEmple}-${i}`}>
                    {b.fInicio ?? "—"} · cia {b.noCia} · empleado {b.noEmple}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <Dialog open={Boolean(modal)} onOpenChange={(open) => !open && setModal(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{modalTitle}</DialogTitle>
            <DialogDescription>
              Número de acción, número de transacción y fechas de cada movimiento.
            </DialogDescription>
          </DialogHeader>
          <MovimientosTable rows={modalRows} />
        </DialogContent>
      </Dialog>
    </ModulePage>
  );
}
