"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toaster";
import { CopyTextButton } from "@/components/monitoreo/CopyTextButton";
import { InformeFotosPaste, type InformeFoto } from "@/components/monitoreo/InformeFotosPaste";

type PilaCatalog = {
  id: string;
  finca: string;
  desmane: string | null;
  paneo: string | null;
  zonaMotorizado: string | null;
  observaciones: string | null;
};

type LlenadoRow = {
  id: string;
  finca: string;
  desmane: string | null;
  paneo: string | null;
  observaciones: string | null;
  recomendaciones: string | null;
};

type DraftRow = {
  pilaFincaId: string;
  finca: string;
  desmane: string;
  paneo: string;
  observaciones: string;
  zonaMotorizado: string;
  registrado: boolean;
  recomendaciones: string;
};

function todayInputValue() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function shiftFecha(ymd: string, deltaDays: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + deltaDays);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}

function formatFechaLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function MonitoreoPilasPage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const canEdit =
    hasPermission(session, "monitoreo.operacion", "edit") ||
    hasPermission(session, "monitoreo.mantenimientos", "edit");

  const [fecha, setFecha] = useState(todayInputValue);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [fotos, setFotos] = useState<InformeFoto[]>([]);
  const [reporte, setReporte] = useState("");
  const [recomendaciones, setRecomendaciones] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [newUbicacion, setNewUbicacion] = useState({
    finca: "",
    zonaMotorizado: "",
    observaciones: "",
  });

  const catalogQ = useQuery<{ data: PilaCatalog[] }>({
    queryKey: ["monitoreo-pilas"],
    queryFn: () => fetch("/api/monitoreo/pilas-fincas").then((r) => r.json()),
  });

  const llenadoQ = useQuery<{ data: LlenadoRow[] }>({
    queryKey: ["monitoreo-pilas-llenado", fecha],
    queryFn: () =>
      fetch(`/api/monitoreo/pilas-llenado?fecha=${encodeURIComponent(fecha)}`).then((r) => r.json()),
  });

  const reporteQ = useQuery<{
    data: { completo: string; reporte: string; recomendaciones: string };
  }>({
    queryKey: ["monitoreo-pilas-reporte", fecha],
    queryFn: () =>
      fetch(`/api/monitoreo/pilas-llenado?fecha=${encodeURIComponent(fecha)}&reporte=1`).then((r) =>
        r.json(),
      ),
  });

  useEffect(() => {
    const catalog = catalogQ.data?.data ?? [];
    const llenados = llenadoQ.data?.data ?? [];
    const byFinca = new Map(llenados.map((l) => [l.finca, l]));
    setDrafts(
      catalog.map((c) => {
        const l = byFinca.get(c.finca);
        return {
          pilaFincaId: c.id,
          finca: c.finca,
          // Cada día arranca vacío si no hay registro guardado (no hereda defaults del catálogo).
          desmane: l?.desmane ?? "",
          paneo: l?.paneo ?? "",
          observaciones: l?.observaciones ?? "",
          zonaMotorizado: c.zonaMotorizado ?? "",
          registrado: !!l,
          recomendaciones: l?.recomendaciones ?? "",
        };
      }),
    );
  }, [catalogQ.data, llenadoQ.data]);

  useEffect(() => {
    setFotos([]);
  }, [fecha]);

  useEffect(() => {
    if (reporteQ.data?.data) {
      setReporte(reporteQ.data.data.reporte);
      setRecomendaciones(reporteQ.data.data.recomendaciones);
    } else {
      setReporte("");
      setRecomendaciones("");
    }
  }, [reporteQ.data, fecha]);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/monitoreo/pilas-llenado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha,
          rows: drafts.map((d, i) => ({
            finca: d.finca,
            pilaFincaId: d.pilaFincaId,
            desmane: d.desmane || null,
            paneo: d.paneo || null,
            observaciones: d.observaciones || null,
            ...(i === 0 && fotos.length
              ? {
                  imagenes: fotos.map(({ url, fileName, mimeType }) => ({
                    url,
                    fileName,
                    mimeType,
                  })),
                }
              : {}),
          })),
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "Error al guardar");
      return json.data;
    },
    onSuccess: (data) => {
      toast.success(`Llenado del ${fecha} registrado`);
      if (data?.report) {
        setReporte(data.report.reporte);
        setRecomendaciones(data.report.recomendaciones);
      }
      void qc.invalidateQueries({ queryKey: ["monitoreo-pilas-llenado"] });
      void qc.invalidateQueries({ queryKey: ["monitoreo-pilas-reporte"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addUbicacion = useMutation({
    mutationFn: async () => {
      const finca = newUbicacion.finca.trim();
      if (!finca) throw new Error("Indicá el nombre de la ubicación / finca");
      const r = await fetch("/api/monitoreo/pilas-fincas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finca,
          zonaMotorizado: newUbicacion.zonaMotorizado.trim() || null,
          observaciones: newUbicacion.observaciones.trim() || null,
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "Error al agregar ubicación");
      return json.data;
    },
    onSuccess: () => {
      toast.success("Ubicación agregada");
      setShowAdd(false);
      setNewUbicacion({ finca: "", zonaMotorizado: "", observaciones: "" });
      void qc.invalidateQueries({ queryKey: ["monitoreo-pilas"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pendientes = useMemo(() => drafts.filter((d) => !d.registrado).length, [drafts]);
  const esHoy = fecha === todayInputValue();

  function updateDraft(idx: number, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }

  function changeFecha(next: string) {
    if (!next) return;
    setFecha(next);
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Llenado de pilas</h1>
          <p className="text-sm text-slate-500">
            Registro diario por ubicación. Cada día tiene sus propios % y observaciones.
          </p>
          <p className="text-sm font-medium text-slate-700 mt-1 capitalize">
            {formatFechaLabel(fecha)}
            {esHoy ? " · Hoy" : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-end gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => changeFecha(shiftFecha(fecha, -1))}
              aria-label="Día anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div>
              <label className="text-xs text-slate-500">Fecha</label>
              <Input
                type="date"
                value={fecha}
                onChange={(e) => changeFecha(e.target.value)}
                className="mt-0.5 w-auto"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => changeFecha(shiftFecha(fecha, 1))}
              aria-label="Día siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!esHoy && (
              <Button type="button" variant="ghost" className="h-9" onClick={() => changeFecha(todayInputValue())}>
                Hoy
              </Button>
            )}
          </div>
          {canEdit && (
            <Button type="button" variant="outline" onClick={() => setShowAdd(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Agregar ubicación
            </Button>
          )}
          <Button onClick={() => save.mutate()} disabled={save.isPending || drafts.length === 0 || !canEdit}>
            {save.isPending ? "Guardando..." : "Guardar registro del día"}
          </Button>
          <CopyTextButton
            text={[reporte, "", recomendaciones].filter(Boolean).join("\n")}
            label="Copiar reporte + recomendaciones"
          />
        </div>
      </div>

      {pendientes > 0 && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
          {pendientes} ubicación(es) sin registro para {fecha}.
        </p>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {catalogQ.isLoading || llenadoQ.isLoading ? (
            <p className="p-8 text-center text-slate-400">Cargando...</p>
          ) : drafts.length === 0 ? (
            <div className="p-8 text-center space-y-3">
              <p className="text-slate-400">No hay ubicaciones configuradas.</p>
              {canEdit && (
                <Button type="button" onClick={() => setShowAdd(true)}>
                  <Plus className="h-4 w-4 mr-1" />
                  Agregar primera ubicación
                </Button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50 text-left">
                  <th className="px-3 py-2 font-medium">Ubicación</th>
                  <th className="px-3 py-2 font-medium">Desmane %</th>
                  <th className="px-3 py-2 font-medium">Paneo %</th>
                  <th className="px-3 py-2 font-medium">Zona</th>
                  <th className="px-3 py-2 font-medium">Observaciones</th>
                  <th className="px-3 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((row, idx) => (
                  <tr key={row.pilaFincaId} className="border-b align-top">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{row.finca}</td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.desmane}
                        onChange={(e) => updateDraft(idx, { desmane: e.target.value })}
                        placeholder="ej. 40"
                        className="h-8 w-24"
                        disabled={!canEdit}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        value={row.paneo}
                        onChange={(e) => updateDraft(idx, { paneo: e.target.value })}
                        placeholder="ej. 55"
                        className="h-8 w-24"
                        disabled={!canEdit}
                      />
                    </td>
                    <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                      {row.zonaMotorizado || "—"}
                    </td>
                    <td className="px-3 py-2 min-w-[12rem]">
                      <Input
                        value={row.observaciones}
                        onChange={(e) => updateDraft(idx, { observaciones: e.target.value })}
                        className="h-8"
                        disabled={!canEdit}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {row.registrado ? (
                        <span className="text-emerald-700 text-xs font-medium">Registrado</span>
                      ) : (
                        <span className="text-amber-700 text-xs font-medium">Pendiente</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Fotos del reporte (Ctrl+V) — {fecha}</CardTitle>
        </CardHeader>
        <CardContent>
          <InformeFotosPaste value={fotos} onChange={setFotos} />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Reporte del día</CardTitle>
            <CopyTextButton text={reporte} label="Copiar" />
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap bg-slate-50 p-3 rounded-md max-h-72 overflow-y-auto">
              {reporte || "Guardá el registro para generar el reporte de este día."}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Recomendaciones</CardTitle>
            <CopyTextButton text={recomendaciones} label="Copiar" />
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap bg-slate-50 p-3 rounded-md max-h-72 overflow-y-auto">
              {recomendaciones || "Se generan al guardar según los % de desmane y paneo del día."}
            </pre>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-slate-400">
        Operador: {session?.user?.name ?? session?.user?.email ?? "—"}
      </p>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar ubicación</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-xs text-slate-500">Nombre (finca / ubicación)</label>
              <Input
                value={newUbicacion.finca}
                onChange={(e) => setNewUbicacion((p) => ({ ...p, finca: e.target.value }))}
                placeholder="ej. Finca Norte"
                className="mt-0.5"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Zona / Motorizado</label>
              <Input
                value={newUbicacion.zonaMotorizado}
                onChange={(e) => setNewUbicacion((p) => ({ ...p, zonaMotorizado: e.target.value }))}
                className="mt-0.5"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Observaciones (catálogo)</label>
              <Input
                value={newUbicacion.observaciones}
                onChange={(e) => setNewUbicacion((p) => ({ ...p, observaciones: e.target.value }))}
                className="mt-0.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => addUbicacion.mutate()}
              disabled={addUbicacion.isPending || !newUbicacion.finca.trim()}
            >
              {addUbicacion.isPending ? "Guardando..." : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
