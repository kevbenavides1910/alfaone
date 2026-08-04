"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";

type Dossier = {
  process: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    parent: { id: string; code: string; name: string } | null;
    children: Array<{ id: string; code: string; name: string }>;
  };
  summary: {
    procedures: number;
    documents: number;
    forms: number;
    requirements: number;
    evidences: number;
    controls: number;
    risks: number;
    legalRequirements: number;
    indicators: number;
    incidents: number;
    audits: number;
    openFindings: number;
    overdueActions: number;
  };
  procedures: Array<{ id: string; code: string; title: string; status: string }>;
  documents: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    documentType: { code: string; name: string };
  }>;
  requirements: Array<{
    id: string;
    code: string;
    title: string;
    isApplicable: boolean;
    standard: { code: string };
    _count: { evidenceLinks: number; findingLinks: number };
  }>;
  evidences: Array<{ id: string; code: string; description: string; evidenceDate: string; type: string }>;
  controls: Array<{
    id: string;
    code: string;
    title: string;
    status: string;
    _count: { evidenceLinks: number; requirementLinks: number };
  }>;
  risks: Array<{
    id: string;
    code: string;
    title: string;
    kind: string;
    status: string;
    inherentScore: number;
    residualScore: number | null;
  }>;
  legalRequirements: Array<{
    id: string;
    code: string;
    title: string;
    legalSource: string;
    complianceStatus: string;
    _count: { evidenceLinks: number };
  }>;
  indicators: Array<{
    id: string;
    code: string;
    title: string;
    unit: string | null;
    targetValue: string | number | null;
    measurements: Array<{ value: string | number; periodStart: string }>;
  }>;
  incidents: Array<{
    id: string;
    code: string;
    title: string;
    type: string;
    severity: string;
    status: string;
    humanRightsImpact: boolean;
    occurredAt: string;
  }>;
  audits: Array<{
    id: string;
    year: number;
    quarter: number;
    status: string;
    scheduledDate: string;
    procedure: { code: string; title: string };
    _count: { findings: number };
  }>;
  openFindings: Array<{
    id: string;
    title: string;
    findingType: string;
    severity: string;
    status: string;
    auditId: string;
  }>;
  overdueActions: Array<{
    id: string;
    title: string;
    dueDate: string | null;
    status: string;
    finding: { auditId: string; title: string };
  }>;
};

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const content = (
    <div className="rounded-lg border bg-white p-4 text-center">
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    </div>
  );
  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

export default function SigProcessDossierPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ["sig-process-dossier", id],
    queryFn: async () => {
      const r = await fetch(`/api/sig/procesos/${id}/dossier`, { credentials: "same-origin" });
      if (!r.ok) throw new Error("No se pudo cargar el expediente");
      const json = await r.json();
      return json.data as Dossier;
    },
  });

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-[#f5f5f5]">
        <Topbar title="Expediente de proceso" />
        <div className="p-6 text-slate-500">
          {error ? (error as Error).message : isLoading ? "Cargando expediente..." : "No encontrado"}
        </div>
      </div>
    );
  }

  const { process, summary } = data;

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <Topbar title={`Expediente — ${process.code}`} />
      <div className="mx-auto max-w-6xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/sig/procesos" className="text-sm text-red-600 hover:underline">
            Volver a procesos
          </Link>
          {process.parent && (
            <Link href={`/sig/procesos/${process.parent.id}`} className="text-sm text-slate-600 hover:underline">
              Padre: {process.parent.code}
            </Link>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {process.code} — {process.name}
            </CardTitle>
            {process.description && <p className="text-sm text-slate-600">{process.description}</p>}
          </CardHeader>
        </Card>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="Procedimientos" value={summary.procedures} />
          <Stat label="Documentos" value={summary.documents} />
          <Stat label="Requisitos" value={summary.requirements} href="/sig/requisitos" />
          <Stat label="Controles" value={summary.controls} href="/sig/controles" />
          <Stat label="Riesgos" value={summary.risks} href="/sig/riesgos" />
          <Stat label="Legales" value={summary.legalRequirements} href="/sig/legales" />
          <Stat label="Indicadores" value={summary.indicators} href="/sig/indicadores" />
          <Stat label="Incidentes" value={summary.incidents} href="/sig/incidentes" />
          <Stat label="Evidencias" value={summary.evidences} href="/sig/evidencias" />
          <Stat label="Auditorías" value={summary.audits} href="/sig/auditorias" />
          <Stat label="Hallazgos abiertos" value={summary.openFindings} />
          <Stat label="Acciones vencidas" value={summary.overdueActions} />
        </div>

        {process.children.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Subprocesos</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {process.children.map((c) => (
                <Link key={c.id} href={`/sig/procesos/${c.id}`}>
                  <Badge variant="outline">
                    {c.code} — {c.name}
                  </Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Procedimientos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.procedures.map((d) => (
                <div key={d.id}>
                  <Link href={`/sig/documentos/${d.id}`} className="text-red-700 hover:underline">
                    {d.code}
                  </Link>{" "}
                  — {d.title}
                </div>
              ))}
              {data.procedures.length === 0 && <p className="text-slate-500">Sin procedimientos</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Controles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.controls.map((c) => (
                <div key={c.id}>
                  <Link href={`/sig/controles/${c.id}`} className="text-red-700 hover:underline">
                    {c.code}
                  </Link>{" "}
                  — {c.title}{" "}
                  <span className="text-xs text-slate-500">
                    ({c._count.requirementLinks} req · {c._count.evidenceLinks} evid.)
                  </span>
                </div>
              ))}
              {data.controls.length === 0 && <p className="text-slate-500">Sin controles</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Riesgos y oportunidades</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.risks.map((r) => (
                <div key={r.id}>
                  <Link href={`/sig/riesgos/${r.id}`} className="text-red-700 hover:underline">
                    {r.code}
                  </Link>{" "}
                  — {r.title}{" "}
                  <Badge variant="outline">{r.kind === "OPPORTUNITY" ? "Oportunidad" : "Riesgo"}</Badge>{" "}
                  <span className="text-xs text-slate-500">
                    score {r.residualScore ?? r.inherentScore}
                  </span>
                </div>
              ))}
              {data.risks.length === 0 && <p className="text-slate-500">Sin riesgos abiertos</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requisitos legales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.legalRequirements.map((l) => (
                <div key={l.id}>
                  <Link href={`/sig/legales/${l.id}`} className="text-red-700 hover:underline">
                    {l.code}
                  </Link>{" "}
                  — {l.title}{" "}
                  <Badge variant="outline">{l.complianceStatus}</Badge>{" "}
                  <span className="text-xs text-slate-500">{l._count.evidenceLinks} evid.</span>
                </div>
              ))}
              {data.legalRequirements.length === 0 && (
                <p className="text-slate-500">Sin requisitos legales</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Indicadores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.indicators.map((i) => {
                const latest = i.measurements[0];
                return (
                  <div key={i.id}>
                    <Link href={`/sig/indicadores/${i.id}`} className="text-red-700 hover:underline">
                      {i.code}
                    </Link>{" "}
                    — {i.title}{" "}
                    <span className="text-xs text-slate-500">
                      {latest
                        ? `último ${Number(latest.value)}${i.unit ? ` ${i.unit}` : ""}`
                        : "sin medición"}
                      {i.targetValue != null ? ` · meta ${i.targetValue}` : ""}
                    </span>
                  </div>
                );
              })}
              {data.indicators.length === 0 && <p className="text-slate-500">Sin indicadores</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Incidentes abiertos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.incidents.map((i) => (
                <div key={i.id}>
                  <Link href={`/sig/incidentes/${i.id}`} className="text-red-700 hover:underline">
                    {i.code}
                  </Link>{" "}
                  — {i.title}{" "}
                  <Badge variant="outline">{i.severity}</Badge>{" "}
                  {i.humanRightsImpact && <Badge variant="danger">DDHH</Badge>}
                </div>
              ))}
              {data.incidents.length === 0 && <p className="text-slate-500">Sin incidentes abiertos</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requisitos ISO</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.requirements.map((r) => (
                <div key={r.id}>
                  <Link href={`/sig/requisitos/${r.id}`} className="text-red-700 hover:underline">
                    {r.standard.code} {r.code}
                  </Link>{" "}
                  — {r.title}
                </div>
              ))}
              {data.requirements.length === 0 && <p className="text-slate-500">Sin requisitos vinculados</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Evidencias recientes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.evidences.slice(0, 20).map((e) => (
                <div key={e.id}>
                  <span className="font-medium">{e.code}</span> — {e.description.slice(0, 80)}{" "}
                  <span className="text-xs text-slate-500">{formatDate(e.evidenceDate)}</span>
                </div>
              ))}
              {data.evidences.length === 0 && <p className="text-slate-500">Sin evidencias</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Auditorías</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {data.audits.map((a) => (
                <div key={a.id}>
                  <Link href={`/audits/${a.id}`} className="text-red-700 hover:underline">
                    {a.year}-T{a.quarter}
                  </Link>{" "}
                  {a.procedure.code} · {a.status} · {a._count.findings} hallazgos
                </div>
              ))}
              {data.audits.length === 0 && <p className="text-slate-500">Sin auditorías</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Hallazgos abiertos / acciones vencidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {data.openFindings.map((f) => (
                <div key={f.id}>
                  <Link href={`/audits/${f.auditId}`} className="text-red-700 hover:underline">
                    {f.title}
                  </Link>{" "}
                  <Badge variant="outline">{f.findingType}</Badge>{" "}
                  <Badge variant={f.severity === "HIGH" || f.severity === "CRITICAL" ? "danger" : "warning"}>
                    {f.severity}
                  </Badge>
                </div>
              ))}
              {data.overdueActions.map((a) => (
                <div key={a.id} className="text-red-800">
                  Vencida: {a.title} ({formatDate(a.dueDate)}) — {a.finding.title}
                </div>
              ))}
              {data.openFindings.length === 0 && data.overdueActions.length === 0 && (
                <p className="text-slate-500">Sin hallazgos abiertos ni acciones vencidas</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
