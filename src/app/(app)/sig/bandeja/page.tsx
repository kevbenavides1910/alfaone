"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";

type BandejaData = {
  approvals: {
    total: number;
    rows: {
      id: string;
      code: string;
      title: string;
      documentType: { name: string };
      pendingVersion: {
        id: string;
        versionLabel: string;
        changeSummary: string | null;
        uploadedBy: { name: string };
        downloadUrl: string;
      } | null;
    }[];
  };
  changeRequests: {
    total: number;
    rows: {
      id: string;
      description: string;
      type: string;
      status: string;
      createdAt: string;
      document: { id: string; code: string; title: string };
      requester: { name: string };
    }[];
  };
  revisions: {
    total: number;
    overdue: number;
    rows: {
      documentId: string;
      code: string;
      title: string;
      daysUntilDue: number;
      isOverdue: boolean;
      nextRevisionDue: string;
    }[];
  };
};

export default function SigBandejaPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["sig-bandeja"],
    queryFn: async () => {
      const r = await fetch("/api/sig/bandeja?withinDays=30", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar bandeja");
      return r.json() as Promise<{ data: BandejaData }>;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ docId, versionId }: { docId: string; versionId: string }) => {
      const r = await fetch(`/api/sig/documents/${docId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ versionId }),
        credentials: "same-origin",
      });
      if (!r.ok) {
        const json = await r.json();
        throw new Error(json?.error?.message ?? "Error al aprobar");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sig-bandeja"] }),
  });

  const d = data?.data;
  const approvals = d?.approvals.rows ?? [];
  const crs = d?.changeRequests.rows ?? [];
  const revs = d?.revisions.rows ?? [];

  return (
    <>
      <Topbar title="SIG — Bandeja de trabajo" />
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="secondary">{d?.approvals.total ?? 0} aprobaciones</Badge>
          <Badge variant="secondary">{d?.changeRequests.total ?? 0} solicitudes</Badge>
          <Badge variant={d?.revisions.overdue ? "destructive" : "outline"}>
            {d?.revisions.overdue ?? 0} vigencias vencidas
          </Badge>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Aprobaciones pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {approvals.length === 0 && (
              <p className="text-sm text-muted-foreground">No tiene documentos por aprobar.</p>
            )}
            {approvals.map((row) => (
              <div key={row.id} className="rounded border p-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/sig/documentos/${row.id}`} className="font-mono text-teal-800 hover:underline">
                    {row.code}
                  </Link>
                  <span className="font-medium">{row.title}</span>
                  <Badge variant="outline">{row.documentType.name}</Badge>
                </div>
                {row.pendingVersion && (
                  <p className="text-xs text-muted-foreground">
                    v{row.pendingVersion.versionLabel} · {row.pendingVersion.uploadedBy.name}
                    {row.pendingVersion.changeSummary
                      ? ` — ${row.pendingVersion.changeSummary}`
                      : ""}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {row.pendingVersion && (
                    <>
                      <Button
                        size="sm"
                        onClick={() =>
                          approveMutation.mutate({
                            docId: row.id,
                            versionId: row.pendingVersion!.id,
                          })
                        }
                        disabled={approveMutation.isPending}
                      >
                        Aprobar
                      </Button>
                      <Button size="sm" variant="outline" asChild>
                        <a href={row.pendingVersion.downloadUrl} target="_blank" rel="noreferrer">
                          Descargar
                        </a>
                      </Button>
                    </>
                  )}
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/sig/documentos/${row.id}`}>Abrir ficha</Link>
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Solicitudes de cambio abiertas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {crs.length === 0 && (
              <p className="text-sm text-muted-foreground">No hay solicitudes abiertas.</p>
            )}
            {crs.map((r) => (
              <div key={r.id} className="rounded border p-3 text-sm space-y-1">
                <div className="flex flex-wrap gap-2 items-center">
                  <Link
                    href={`/sig/documentos/${r.document.id}#procedimiento`}
                    className="font-mono text-teal-800 hover:underline"
                  >
                    {r.document.code}
                  </Link>
                  <Badge variant="outline">{r.type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {r.requester.name} · {formatDate(r.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-muted-foreground">{r.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Vigencias (30 días)</CardTitle>
            <Button size="sm" variant="outline" asChild>
              <Link href="/sig/vigencias">Ver todas</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {revs.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin documentos por renovar.</p>
            )}
            {revs.slice(0, 15).map((r) => (
              <div key={r.documentId} className="flex flex-wrap items-center gap-2 text-sm">
                <Link
                  href={`/sig/documentos/${r.documentId}`}
                  className="font-mono text-teal-800 hover:underline"
                >
                  {r.code}
                </Link>
                <span className="truncate max-w-xs">{r.title}</span>
                {r.isOverdue ? (
                  <Badge variant="destructive">Vencido</Badge>
                ) : (
                  <Badge variant="outline">En {r.daysUntilDue} d</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatDate(r.nextRevisionDue)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
