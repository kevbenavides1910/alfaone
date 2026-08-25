"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type AuditRow = {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  result: string;
  message: string | null;
  ipAddress: string | null;
  createdAt: string;
  userName: string | null;
};

type SyncRow = {
  id: string;
  direction: string;
  status: string;
  operation: string;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
  triggeredByName: string | null;
};

export function FingerAuditPanel() {
  const [tab, setTab] = useState<"operations" | "sync">("operations");
  const [q, setQ] = useState("");

  const opsQuery = useQuery<{ data: { items: AuditRow[]; total: number } }>({
    queryKey: ["finger-audit-ops", q],
    queryFn: async () => {
      const qs = new URLSearchParams({ pageSize: "50" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/finger-system/audit/operations?${qs}`, { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error");
      return json;
    },
    enabled: tab === "operations",
  });

  const syncQuery = useQuery<{ data: { items: SyncRow[]; total: number } }>({
    queryKey: ["finger-audit-sync"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/audit/sync?pageSize=50", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error");
      return json;
    },
    enabled: tab === "sync",
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Registro de auditoría</CardTitle>
        <div className="flex flex-wrap gap-2 mt-2">
          <Button
            size="sm"
            variant={tab === "operations" ? "default" : "outline"}
            onClick={() => setTab("operations")}
          >
            Operaciones
          </Button>
          <Button size="sm" variant={tab === "sync" ? "default" : "outline"} onClick={() => setTab("sync")}>
            Sincronizaciones
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {tab === "operations" ? (
          <>
            <Input
              placeholder="Buscar acción, usuario, entidad…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="max-w-md"
            />
            <AuditOpsTable rows={opsQuery.data?.data.items ?? []} loading={opsQuery.isLoading} />
          </>
        ) : (
          <SyncTable rows={syncQuery.data?.data.items ?? []} loading={syncQuery.isLoading} />
        )}
      </CardContent>
    </Card>
  );
}

function AuditOpsTable({ rows, loading }: { rows: AuditRow[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-slate-500">Cargando…</p>;
  return (
    <div className="overflow-auto rounded-lg border max-h-[28rem]">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left">Fecha</th>
            <th className="px-3 py-2 text-left">Acción</th>
            <th className="px-3 py-2 text-left">Usuario</th>
            <th className="px-3 py-2 text-left">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {new Date(r.createdAt).toLocaleString("es-CR")}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
              <td className="px-3 py-2">{r.userName ?? "—"}</td>
              <td className="px-3 py-2 text-xs text-slate-600">{r.message ?? r.entityType ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                Sin registros de auditoría aún.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function SyncTable({ rows, loading }: { rows: SyncRow[]; loading: boolean }) {
  if (loading) return <p className="text-sm text-slate-500">Cargando…</p>;
  return (
    <div className="overflow-auto rounded-lg border max-h-[28rem]">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 sticky top-0">
          <tr>
            <th className="px-3 py-2 text-left">Inicio</th>
            <th className="px-3 py-2 text-left">Operación</th>
            <th className="px-3 py-2 text-left">Estado</th>
            <th className="px-3 py-2 text-left">Mensaje</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="px-3 py-2 text-xs">{new Date(r.startedAt).toLocaleString("es-CR")}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.operation}</td>
              <td className="px-3 py-2">
                <Badge variant="secondary">{r.status}</Badge>
              </td>
              <td className="px-3 py-2 text-xs text-slate-600">{r.message ?? "—"}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                Sin sincronizaciones registradas.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
