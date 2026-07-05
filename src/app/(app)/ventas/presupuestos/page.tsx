"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, Plus, Settings2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/lib/permissions/check";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import { VENTAS_PRESUPUESTO_ESTADO_LABELS } from "@/modules/ventas/client";

type PresupuestoRow = {
  id: string;
  licitacionNo: string;
  compania: string;
  nombre: string | null;
  estado: string;
  totalMensual: number | null;
  totalConIva: number | null;
  lineasCount: number;
  oportunidad: { id: string; cliente: string; estado: string } | null;
  updatedAt: string;
};

type ListResponse = { data: { rows: PresupuestoRow[]; total: number; page: number; totalPages: number } };

type OportunidadOption = {
  id: string;
  licitacionNo: string;
  cliente: string;
  descripcion: string;
};

function estadoBadge(estado: string) {
  const label = VENTAS_PRESUPUESTO_ESTADO_LABELS[estado] ?? estado;
  if (estado === "FINALIZADO") return <Badge className="bg-emerald-600 hover:bg-emerald-600">{label}</Badge>;
  if (estado === "EN_REVISION") return <Badge className="bg-amber-600 hover:bg-amber-600">{label}</Badge>;
  return <Badge variant="secondary">{label}</Badge>;
}

export default function PresupuestosPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canEdit = hasPermission(session, "ventas.presupuestos", "edit");

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [licitacionNo, setLicitacionNo] = useState("");
  const [oportunidadId, setOportunidadId] = useState("");

  const queryParams = useMemo(() => {
    const sp = new URLSearchParams();
    sp.set("page", String(page));
    sp.set("pageSize", "25");
    if (q.trim()) sp.set("q", q.trim());
    return sp.toString();
  }, [q, page]);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["ventas-presupuestos", queryParams],
    queryFn: async () => {
      const res = await fetch(`/api/ventas/presupuestos?${queryParams}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Error al cargar presupuestos");
      return (await res.json()) as ListResponse;
    },
    placeholderData: keepPreviousData,
  });

  const { data: oportunidadesData } = useQuery({
    queryKey: ["ventas-oportunidades-participar"],
    queryFn: async () => {
      const sp = new URLSearchParams({ estado: "PARTICIPAR", pageSize: "100" });
      const res = await fetch(`/api/ventas/oportunidades?${sp}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Error");
      const json = (await res.json()) as { data: { rows: OportunidadOption[] } };
      return json.data.rows;
    },
    enabled: showCreate && canEdit,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, string> = {
        licitacionNo: licitacionNo.trim(),
      };
      if (oportunidadId) body.oportunidadId = oportunidadId;
      const res = await fetch("/api/ventas/presupuestos", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(err?.error?.message ?? "No se pudo crear");
      }
      return (await res.json()) as { data: { id: string } };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["ventas-presupuestos"] });
      setShowCreate(false);
      window.location.href = `/ventas/presupuestos/${result.data.id}`;
    },
  });

  const rows = data?.data.rows ?? [];
  const payload = data?.data;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-800">
            <Calculator className="h-5 w-5 text-violet-600" />
            <h1 className="text-xl font-semibold">Presupuestos de licitación</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Elaboración de ofertas con cálculo en el sistema: agregue líneas de detalle (jornada, equipamiento, puestos)
            y el motor calcula MO, GA, insumos, imprevistos y margen automáticamente.
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <Link href="/ventas/presupuestos/parametros">
              <Button size="sm" variant="outline">
                <Settings2 className="h-4 w-4 mr-1" />
                Parametrización
              </Button>
            </Link>
            <Button size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" />
              Nuevo presupuesto
            </Button>
          </div>
        )}
      </div>

      {showCreate && canEdit && (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3 max-w-xl">
          <h2 className="font-medium text-sm">Crear presupuesto</h2>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Oportunidad (opcional)</label>
            <select
              className="w-full h-9 text-sm border rounded-md px-2"
              value={oportunidadId}
              onChange={(e) => {
                setOportunidadId(e.target.value);
                const op = oportunidadesData?.find((o) => o.id === e.target.value);
                if (op) setLicitacionNo(op.licitacionNo);
              }}
            >
              <option value="">Sin vincular</option>
              {oportunidadesData?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.licitacionNo} — {o.cliente}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Número de licitación</label>
            <Input value={licitacionNo} onChange={(e) => setLicitacionNo(e.target.value)} placeholder="2025LY-6-6100001" />
          </div>
          <Button
            size="sm"
            disabled={!licitacionNo.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creando…" : "Crear y abrir"}
          </Button>
          {createMutation.isError && (
            <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
          )}
        </div>
      )}

      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Buscar por licitación o compañía…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        {isFetching && !isLoading && <span className="text-xs text-muted-foreground self-center">Filtrando…</span>}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="overflow-auto max-h-[calc(100vh-16rem)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-3 py-2 text-left font-medium">Licitación</th>
                <th className="px-3 py-2 text-left font-medium">Compañía</th>
                <th className="px-3 py-2 text-left font-medium">Cliente</th>
                <th className="px-3 py-2 text-left font-medium">Estado</th>
                <th className="px-3 py-2 text-right font-medium">Total mensual</th>
                <th className="px-3 py-2 text-right font-medium">Con IVA</th>
                <th className="px-3 py-2 text-center font-medium">Líneas</th>
                <th className="px-3 py-2 text-left font-medium">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">Cargando…</td>
                </tr>
              )}
              {!isLoading && rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    No hay presupuestos. Cree uno desde una oportunidad en estado Participar.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t hover:bg-muted/40">
                  <td className="px-3 py-2">
                    <Link href={`/ventas/presupuestos/${row.id}`} className="text-red-600 hover:underline font-medium">
                      {row.licitacionNo}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{row.compania}</td>
                  <td className="px-3 py-2">{row.oportunidad?.cliente ?? "—"}</td>
                  <td className="px-3 py-2">{estadoBadge(row.estado)}</td>
                  <td className="px-3 py-2 text-right">{row.totalMensual != null ? formatCurrency(row.totalMensual) : "—"}</td>
                  <td className="px-3 py-2 text-right">{row.totalConIva != null ? formatCurrency(row.totalConIva) : "—"}</td>
                  <td className="px-3 py-2 text-center">{row.lineasCount}</td>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(row.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {payload && payload.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Página {payload.page} de {payload.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= payload.totalPages} onClick={() => setPage((p) => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}
    </div>
  );
}
