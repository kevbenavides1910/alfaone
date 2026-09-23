"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";

type Dashboard = {
  generatedAt: string;
  coverage: {
    applicable: number;
    compliant: number;
    noEvidence: number;
    stale: number;
    openNc: number;
    coveragePct: number;
  };
  documents: { revisionDue: number; revisionOverdue: number };
  controls: {
    active: number;
    overdue: number;
    dueSoon: number;
    rows: {
      id: string;
      code: string;
      title: string;
      freshness: string;
      process: { code: string; name: string } | null;
    }[];
  };
  capa: {
    openFindings: number;
    overdueActions: number;
    closurePct: number;
    efficacyPending: number;
  };
  indicators: { red: number; yellow: number; overdue: number };
  risks: { high: number; total: number };
  incidents: { open: number; total: number };
  upcomingAudits: {
    id: string;
    title: string;
    scheduledDate: string | null;
    status: string;
    procedure: { id: string; code: string; title: string };
  }[];
  gapsPreview: {
    id: string;
    code: string;
    title: string;
    complianceLabel: string;
    standardCode: string;
  }[];
};

function Metric({
  href,
  label,
  value,
  tone,
}: {
  href: string;
  label: string;
  value: string | number;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const tones = {
    ok: "bg-emerald-50 text-emerald-900 ring-emerald-100",
    warn: "bg-amber-50 text-amber-950 ring-amber-100",
    bad: "bg-red-50 text-red-900 ring-red-100",
    neutral: "bg-white text-slate-800 ring-slate-200",
  };
  return (
    <Link
      href={href}
      className={`rounded-xl px-4 py-3 ring-1 transition hover:shadow-sm ${tones[tone ?? "neutral"]}`}
    >
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-0.5 text-xs font-medium opacity-80">{label}</div>
    </Link>
  );
}

export default function SigTableroPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["sig-tablero"],
    queryFn: async () => {
      const r = await fetch("/api/sig/tablero", { credentials: "same-origin" });
      if (!r.ok) throw new Error("No se pudo cargar el tablero");
      const json = await r.json();
      return json.data as Dashboard;
    },
  });

  const d = data;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title="Tablero SGC / SOMS" />
      <div className="mx-auto max-w-[1200px] space-y-4 p-4 md:p-6">
        {isLoading && <p className="text-sm text-slate-500">Cargando tablero…</p>}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {(error as Error).message}
          </div>
        )}

        {d && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-sm text-slate-600">
                  Cobertura de requisitos aplicables con evidencia vigente
                </p>
                <p className="text-4xl font-semibold tabular-nums text-slate-900">
                  {d.coverage.coveragePct}%
                  <span className="ml-2 text-base font-normal text-slate-500">
                    ({d.coverage.compliant} de {d.coverage.applicable})
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link href="/sig/requisitos">Abrir matriz</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/sig/bandeja">Bandeja</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric
                href="/sig/requisitos?attention=noEvidence"
                label="Sin evidencias"
                value={d.coverage.noEvidence}
                tone={d.coverage.noEvidence ? "warn" : "ok"}
              />
              <Metric
                href="/sig/requisitos?attention=stale"
                label="Evidencia vencida"
                value={d.coverage.stale}
                tone={d.coverage.stale ? "warn" : "ok"}
              />
              <Metric
                href="/sig/requisitos?attention=openNc"
                label="NC abiertas (matriz)"
                value={d.coverage.openNc}
                tone={d.coverage.openNc ? "bad" : "ok"}
              />
              <Metric
                href="/sig/auditorias/capa"
                label="Acciones CAPA vencidas"
                value={d.capa.overdueActions}
                tone={d.capa.overdueActions ? "bad" : "ok"}
              />
              <Metric
                href="/sig/controles"
                label="Controles sin evidencia / vencidos"
                value={d.controls.overdue}
                tone={d.controls.overdue ? "warn" : "ok"}
              />
              <Metric
                href="/sig/vigencias"
                label="Documentos por renovar"
                value={d.documents.revisionDue}
                tone={d.documents.revisionOverdue ? "bad" : "neutral"}
              />
              <Metric
                href="/sig/indicadores"
                label="Indicadores en rojo"
                value={d.indicators.red}
                tone={d.indicators.red ? "bad" : "ok"}
              />
              <Metric
                href="/sig/riesgos"
                label="Riesgos altos / críticos"
                value={d.risks.high}
                tone={d.risks.high ? "bad" : "ok"}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Brechas de requisitos</CardTitle>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/sig/requisitos?attention=noEvidence">Ver todas</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.gapsPreview.length === 0 && (
                    <p className="text-sm text-slate-500">Sin brechas en requisitos aplicables.</p>
                  )}
                  {d.gapsPreview.map((g) => (
                    <div key={g.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge variant="outline">{g.standardCode.replace("ISO_", "")}</Badge>
                      <Link href={`/sig/requisitos/${g.id}`} className="font-mono text-red-700 hover:underline">
                        {g.code}
                      </Link>
                      <span className="truncate text-slate-700">{g.title}</span>
                      <Badge variant="secondary">{g.complianceLabel}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Controles a atender</CardTitle>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/sig/controles">Ver controles</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.controls.rows.length === 0 && (
                    <p className="text-sm text-slate-500">Controles activos al día.</p>
                  )}
                  {d.controls.rows.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={`/sig/controles/${c.id}`} className="font-mono text-teal-800 hover:underline">
                        {c.code}
                      </Link>
                      <span className="truncate">{c.title}</span>
                      <Badge variant={c.freshness === "OVERDUE" ? "destructive" : "secondary"}>
                        {c.freshness === "NO_EVIDENCE"
                          ? "Sin evidencia"
                          : c.freshness === "OVERDUE"
                            ? "Vencido"
                            : c.freshness}
                      </Badge>
                      {c.process && (
                        <span className="text-xs text-slate-500">{c.process.code}</span>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-base">Próximas auditorías</CardTitle>
                  <Button size="sm" variant="outline" asChild>
                    <Link href="/sig/auditorias">Programa</Link>
                  </Button>
                </CardHeader>
                <CardContent className="space-y-2">
                  {d.upcomingAudits.length === 0 && (
                    <p className="text-sm text-slate-500">No hay auditorías planificadas próximas.</p>
                  )}
                  {d.upcomingAudits.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={`/audits/${a.id}`} className="font-medium text-red-700 hover:underline">
                        {a.title}
                      </Link>
                      <span className="text-slate-500">
                        {a.scheduledDate ? formatDate(a.scheduledDate) : "—"}
                      </span>
                      <Badge variant="outline">{a.status}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">CAPA e incidentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">NC abiertas: {d.capa.openFindings}</Badge>
                    <Badge variant={d.capa.overdueActions ? "destructive" : "outline"}>
                      Acciones vencidas: {d.capa.overdueActions}
                    </Badge>
                    <Badge variant="outline">Cierre {d.capa.closurePct}%</Badge>
                    <Badge variant="outline">Eficacia pendiente: {d.capa.efficacyPending}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/sig/auditorias/capa">Dashboard CAPA</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/sig/incidentes">
                        Incidentes abiertos ({d.incidents.open})
                      </Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link href="/sig/revision-direccion">Revisión dirección</Link>
                    </Button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Actualizado {formatDate(d.generatedAt)}
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
