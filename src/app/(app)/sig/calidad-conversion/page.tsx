"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";

type Item = {
  documentId: string;
  versionId: string;
  code: string;
  title: string;
  versionLabel: string;
  documentType: { name: string };
  textIndexStatus: string;
  textIndexedAt: string | null;
  activitiesCount: number;
  stagesCount: number;
  issue: string;
};

const ISSUE_LABELS: Record<string, string> = {
  INDEX_FAILED: "Indexación fallida",
  INDEX_PENDING: "Indexación pendiente",
  INDEX_SKIPPED: "Sin texto extraíble",
  NO_ACTIVITIES: "Sin tabla de actividades",
  EMPTY_STRUCTURE: "Estructura vacía",
};

export default function SigCalidadConversionPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["sig-conversion-quality"],
    queryFn: async () => {
      const r = await fetch("/api/sig/conversion-quality", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar cola");
      return r.json() as Promise<{ data: { rows: Item[]; total: number } }>;
    },
  });

  const reindexMutation = useMutation({
    mutationFn: async (item: Item) => {
      const r = await fetch(`/api/sig/documents/${item.documentId}/reindex`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ versionId: item.versionId }),
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json?.error?.message ?? "Error al reindexar");
      return json;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sig-conversion-quality"] }),
  });

  const rows = data?.data.rows ?? [];

  return (
    <>
      <Topbar title="SIG — Calidad de conversión" />
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cola de revisión</CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Documentos con indexación fallida o conversión Alfa incompleta. Use «Reintentar» para
              reindexar y convertir.
            </p>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {isLoading && <p className="p-4 text-sm text-muted-foreground">Cargando…</p>}
            {!isLoading && rows.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">Cola vacía — todo en orden.</p>
            )}
            {rows.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2">Documento</th>
                    <th className="px-3 py-2">Problema</th>
                    <th className="px-3 py-2">Índice</th>
                    <th className="px-3 py-2">Actividades</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.versionId} className="border-b align-top">
                      <td className="px-3 py-2">
                        <Link
                          href={`/sig/documentos/${row.documentId}#procedimiento`}
                          className="font-mono text-teal-800 hover:underline"
                        >
                          {row.code}
                        </Link>
                        <div className="text-muted-foreground">{row.title}</div>
                        <div className="text-xs">
                          v{row.versionLabel} · {row.documentType.name}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{ISSUE_LABELS[row.issue] ?? row.issue}</Badge>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.textIndexStatus}
                        {row.textIndexedAt && (
                          <div className="text-[11px] text-muted-foreground">
                            {formatDate(row.textIndexedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {row.activitiesCount} act. / {row.stagesCount} sec.
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={reindexMutation.isPending}
                          onClick={() => reindexMutation.mutate(row)}
                        >
                          Reintentar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
