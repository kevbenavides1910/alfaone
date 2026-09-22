"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";

type TraceData = {
  document: {
    process: { id: string; code: string; name: string } | null;
  };
  controls: {
    id: string;
    code: string;
    title: string;
    status: string;
    risks: {
      id: string;
      code: string;
      title: string;
      kind: string;
      residualScore: number | null;
      inherentScore: number | null;
    }[];
  }[];
  requirements: {
    id: string;
    code: string;
    title: string;
    standard: { code: string; name: string } | null;
  }[];
  audits: {
    id: string;
    year: number;
    quarter: number;
    status: string;
    scheduledDate: string;
    procedure: { code: string; title: string };
  }[];
  processControlsSuggested: { id: string; code: string; title: string }[];
};

export function DocumentTraceabilityPanel({ documentId }: { documentId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["sig-document-traceability", documentId],
    queryFn: async () => {
      const r = await fetch(`/api/sig/documents/${documentId}/traceability`, {
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Error al cargar trazabilidad");
      return r.json() as Promise<{ data: TraceData }>;
    },
  });

  const t = data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Trazabilidad documento ↔ proceso ↔ control</CardTitle>
        <p className="text-xs text-muted-foreground font-normal">
          Controles y requisitos ligados a este documento, riesgos asociados y auditorías del
          procedimiento/proceso.
          {t?.document.process && (
            <>
              {" "}
              Proceso:{" "}
              <Link
                href={`/sig/procesos/${t.document.process.id}`}
                className="text-teal-800 hover:underline"
              >
                {t.document.process.code} — {t.document.process.name}
              </Link>
            </>
          )}
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {isLoading && <p className="text-muted-foreground">Cargando…</p>}

        {t && (
          <>
            <div>
              <h4 className="font-medium mb-2">Controles vinculados</h4>
              {t.controls.length === 0 ? (
                <p className="text-muted-foreground text-xs">Ningún control ligado directamente.</p>
              ) : (
                <ul className="space-y-2">
                  {t.controls.map((c) => (
                    <li key={c.id} className="rounded border p-2">
                      <Link href={`/sig/controles/${c.id}`} className="text-teal-800 hover:underline font-mono">
                        {c.code}
                      </Link>{" "}
                      — {c.title}{" "}
                      <Badge variant="outline">{c.status}</Badge>
                      {c.risks.length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
                          {c.risks.map((r) => (
                            <div key={r.id}>
                              Riesgo{" "}
                              <Link href={`/sig/riesgos/${r.id}`} className="hover:underline">
                                {r.code}
                              </Link>{" "}
                              — {r.title} (score {r.residualScore ?? r.inherentScore ?? "—"})
                            </div>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2">Requisitos</h4>
              {t.requirements.length === 0 ? (
                <p className="text-muted-foreground text-xs">Sin requisitos ligados.</p>
              ) : (
                <ul className="space-y-1">
                  {t.requirements.map((r) => (
                    <li key={r.id}>
                      <Link href={`/sig/requisitos/${r.id}`} className="text-teal-800 hover:underline font-mono">
                        {r.code}
                      </Link>{" "}
                      — {r.title}
                      {r.standard && (
                        <span className="text-xs text-muted-foreground"> ({r.standard.code})</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 className="font-medium mb-2">Auditorías</h4>
              {t.audits.length === 0 ? (
                <p className="text-muted-foreground text-xs">Sin auditorías registradas.</p>
              ) : (
                <ul className="space-y-1">
                  {t.audits.map((a) => (
                    <li key={a.id}>
                      <Link href={`/audits/${a.id}`} className="text-teal-800 hover:underline">
                        {a.year}-Q{a.quarter}
                      </Link>{" "}
                      <Badge variant="outline">{a.status}</Badge>{" "}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(a.scheduledDate)} · {a.procedure.code}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {t.processControlsSuggested.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Controles del proceso (sin vínculo directo)</h4>
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {t.processControlsSuggested.slice(0, 12).map((c) => (
                    <li key={c.id}>
                      <Link href={`/sig/controles/${c.id}`} className="hover:underline">
                        {c.code}
                      </Link>{" "}
                      — {c.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
