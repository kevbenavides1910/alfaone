"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/utils/format";

type TrafficLight = "GREEN" | "YELLOW" | "RED" | "GRAY";

type ReviewRow = {
  id: string;
  code: string;
  title: string;
  status: string;
  meetingDate: string;
  location: string | null;
  formCode: string;
  trafficLight: TrafficLight;
  openActions: number;
  overdueActions: number;
  coveredInputs: number;
  totalInputs: number;
  _count: { actions: number; evidenceLinks: number };
};

const LIGHT_STYLE: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-100 text-emerald-800",
  YELLOW: "bg-amber-100 text-amber-800",
  RED: "bg-red-100 text-red-800",
  GRAY: "bg-slate-100 text-slate-600",
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  IN_PROGRESS: "En curso",
  COMPLETED: "Completada",
  FOLLOW_UP: "Seguimiento",
  CLOSED: "Cerrada",
};

export default function SigRevisionDireccionPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: `Revisión por la dirección ${new Date().getFullYear()}`,
    meetingDate: new Date().toISOString().slice(0, 10),
    periodStart: `${new Date().getFullYear()}-01-01`,
    periodEnd: new Date().toISOString().slice(0, 10),
    location: "",
    attendees: "",
    agenda: "",
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sig-management-reviews", q, status, year],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (year) params.set("year", year);
      const r = await fetch(`/api/sig/management-reviews?${params}`, {
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Error cargando revisiones");
      const json = await r.json();
      return json.data as ReviewRow[];
    },
  });

  const summary = useMemo(
    () => ({
      total: rows.length,
      open: rows.filter((r) => r.status !== "CLOSED").length,
      followUp: rows.filter((r) => r.status === "FOLLOW_UP" || r.openActions > 0).length,
      overdue: rows.filter((r) => r.overdueActions > 0).length,
    }),
    [rows]
  );

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/sig/management-reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          meetingDate: form.meetingDate,
          periodStart: form.periodStart || null,
          periodEnd: form.periodEnd || null,
          location: form.location || null,
          attendees: form.attendees || null,
          agenda: form.agenda || null,
          status: "DRAFT",
        }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error?.message ?? "No se pudo crear");
      await qc.invalidateQueries({ queryKey: ["sig-management-reviews"] });
      if (json.data?.id) {
        window.location.href = `/sig/revision-direccion/${json.data.id}`;
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error creando revisión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Topbar title="Revisión por la dirección · ISO 9001 9.3" />
      <div className="space-y-6 p-4 md:p-6">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            F-SIG-18 / F-SIG-19 · P-SIG-04
          </p>
          <h1 className="text-2xl font-semibold text-slate-900">Revisión por la dirección</h1>
          <p className="text-sm text-slate-500">
            Actas anuales, entradas ISO 9.3.2, salidas 9.3.3 y seguimiento de pendientes.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Total</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{summary.total}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Abiertas</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-amber-700">{summary.open}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Con seguimiento</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold">{summary.followUp}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-slate-500">Acciones vencidas</CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-red-700">{summary.overdue}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Programar revisión (F-SIG-18)</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3 md:grid-cols-2" onSubmit={onCreate}>
              <div className="space-y-1 md:col-span-2">
                <Label>Título</Label>
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Fecha de reunión</Label>
                <Input
                  type="date"
                  required
                  value={form.meetingDate}
                  onChange={(e) => setForm((f) => ({ ...f, meetingDate: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Lugar</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Periodo desde</Label>
                <Input
                  type="date"
                  value={form.periodStart}
                  onChange={(e) => setForm((f) => ({ ...f, periodStart: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Periodo hasta</Label>
                <Input
                  type="date"
                  value={form.periodEnd}
                  onChange={(e) => setForm((f) => ({ ...f, periodEnd: e.target.value }))}
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Asistentes</Label>
                <Textarea
                  rows={2}
                  value={form.attendees}
                  onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))}
                  placeholder="Nombre y cargo, uno por línea"
                />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label>Agenda</Label>
                <Textarea
                  rows={2}
                  value={form.agenda}
                  onChange={(e) => setForm((f) => ({ ...f, agenda: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Button type="submit" disabled={saving || !form.title.trim()}>
                  {saving ? "Creando..." : "Crear acta"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Todos los estados</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <Input
            className="w-28"
            type="number"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Año"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Historial de revisiones</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {isLoading ? (
              <p className="text-sm text-slate-500">Cargando...</p>
            ) : (
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="border-b text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-2 py-2">Código</th>
                    <th className="px-2 py-2">Revisión</th>
                    <th className="px-2 py-2">Fecha</th>
                    <th className="px-2 py-2">Estado</th>
                    <th className="px-2 py-2">Entradas</th>
                    <th className="px-2 py-2">Acciones</th>
                    <th className="px-2 py-2">Semáforo</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b align-top">
                      <td className="px-2 py-2">
                        <Link
                          href={`/sig/revision-direccion/${row.id}`}
                          className="font-medium text-red-700 hover:underline"
                        >
                          {row.code}
                        </Link>
                        <div className="text-xs text-slate-500">{row.formCode}</div>
                      </td>
                      <td className="px-2 py-2">
                        {row.title}
                        {row.location && (
                          <div className="text-xs text-slate-500">{row.location}</div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-xs">{formatDate(row.meetingDate)}</td>
                      <td className="px-2 py-2">
                        <Badge variant="outline">{STATUS_LABEL[row.status] ?? row.status}</Badge>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {row.coveredInputs}/{row.totalInputs || 12}
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {row.openActions} abiertas
                        {row.overdueActions > 0 && (
                          <span className="ml-1 text-red-600">({row.overdueActions} venc.)</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${LIGHT_STYLE[row.trafficLight]}`}>
                          {row.trafficLight}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-2 py-6 text-center text-slate-500">
                        Sin revisiones registradas
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
