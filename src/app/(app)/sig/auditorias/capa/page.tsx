"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils/format";

type CapaData = {
  year: number;
  findings: {
    total: number;
    open: number;
    closed: number;
    closurePct: number;
    bySeverity: Record<string, number>;
    openRows: Array<{
      id: string;
      title: string;
      severity: string;
      status: string;
      auditId: string;
      createdAt: string;
      audit: { year: number; quarter: number; procedure: { code: string } };
      _count: { actionPlans: number };
    }>;
  };
  actions: {
    total: number;
    open: number;
    overdue: number;
    completed: number;
    completionPct: number;
    overdueRows: Array<{
      id: string;
      title: string;
      dueDate: string | null;
      status: string;
      finding: {
        auditId: string;
        title: string;
        severity: string;
        audit: { year: number; quarter: number; procedure: { code: string } };
      };
      responsibleUser: { name: string } | null;
    }>;
  };
  efficacy: {
    pending: number;
    verified: number;
    notEffective: number;
    verifiedPct: number;
  };
};

export default function SigCapaDashboardPage() {
  const [year, setYear] = useState(new Date().getFullYear());
  const { data, isLoading } = useQuery({
    queryKey: ["sig-capa", year],
    queryFn: async () => {
      const r = await fetch(`/api/sig/capa?year=${year}`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar CAPA");
      return r.json() as Promise<{ data: CapaData }>;
    },
  });

  const d = data?.data;

  return (
    <>
      <Topbar title="SIG — Tablero CAPA (hallazgos y eficacia)" />
      <div className="p-4 max-w-6xl mx-auto space-y-4">
        <div className="flex items-end gap-3">
          <div className="w-28">
            <Label className="text-xs">Año</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
            />
          </div>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        {d && (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold">{d.findings.closurePct}%</div>
                  <div className="text-xs text-muted-foreground">Cierre de hallazgos</div>
                  <div className="text-xs mt-1">
                    {d.findings.closed}/{d.findings.total} · abiertos {d.findings.open}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold text-red-700">{d.actions.overdue}</div>
                  <div className="text-xs text-muted-foreground">Acciones vencidas</div>
                  <div className="text-xs mt-1">
                    Completadas {d.actions.completionPct}% ({d.actions.completed}/{d.actions.total})
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="text-2xl font-semibold">{d.efficacy.verifiedPct}%</div>
                  <div className="text-xs text-muted-foreground">Eficacia verificada</div>
                  <div className="text-xs mt-1">
                    Pendientes {d.efficacy.pending} · No eficaces {d.efficacy.notEffective}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 space-y-1">
                  <div className="text-xs text-muted-foreground">NC abiertas por severidad</div>
                  {Object.entries(d.findings.bySeverity).map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span>{k}</span>
                      <Badge variant="outline">{v}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Acciones vencidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {d.actions.overdueRows.length === 0 && (
                  <p className="text-muted-foreground">Sin acciones vencidas.</p>
                )}
                {d.actions.overdueRows.map((a) => (
                  <div key={a.id} className="rounded border p-2 flex flex-wrap gap-2 items-center">
                    <Link href={`/audits/${a.finding.auditId}`} className="text-teal-800 hover:underline">
                      {a.finding.audit.procedure.code} {a.finding.audit.year}-Q{a.finding.audit.quarter}
                    </Link>
                    <span className="font-medium">{a.title}</span>
                    <Badge variant="destructive">Venció {formatDate(a.dueDate)}</Badge>
                    {a.responsibleUser && (
                      <span className="text-xs text-muted-foreground">{a.responsibleUser.name}</span>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Hallazgos abiertos</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {d.findings.openRows.map((f) => (
                  <div key={f.id} className="rounded border p-2 flex flex-wrap gap-2 items-center">
                    <Link href={`/audits/${f.auditId}`} className="text-teal-800 hover:underline">
                      {f.audit.procedure.code}
                    </Link>
                    <span>{f.title}</span>
                    <Badge variant="outline">{f.severity}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {f._count.actionPlans} plan(es) · {formatDate(f.createdAt)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  );
}
