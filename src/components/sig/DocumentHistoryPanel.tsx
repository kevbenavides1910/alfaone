"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";
import { sigAuditActionLabel } from "@/modules/sig/business/audit-labels";
import { DocumentVersionCompare } from "./DocumentVersionCompare";

export type DocumentVersionHistoryRow = {
  id: string;
  versionNumber: number;
  versionLabel: string;
  revisionDate: string;
  effectiveFrom: string;
  effectiveUntil: string | null;
  status: string;
  fileName: string;
  changeSummary?: string | null;
  createdAt?: string;
  downloadUrl: string;
  uploadedBy: { name: string };
  approvedBy: { name: string } | null;
  approvedAt?: string | null;
};

type BitacoraRow = {
  id: string;
  action: string;
  notes: string | null;
  createdAt: string;
  version: { versionLabel: string; versionNumber?: number } | null;
  actor: { name: string };
};

const STATUS_LABELS: Record<string, string> = {
  PENDING_APPROVAL: "Pendiente",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  SUPERSEDED: "Anterior",
  OBSOLETE: "Obsoleto",
  DRAFT: "Borrador",
};

type Props = {
  documentId: string;
  versions: DocumentVersionHistoryRow[];
  currentVersionId?: string | null;
};

export function DocumentHistoryPanel({ documentId, versions, currentVersionId }: Props) {
  const [compareOpen, setCompareOpen] = useState(false);
  const { data: bitacoraData, isLoading: bitacoraLoading } = useQuery({
    queryKey: ["sig-document-bitacora", documentId],
    queryFn: async () => {
      const r = await fetch(
        `/api/sig/bitacora?documentId=${encodeURIComponent(documentId)}&pageSize=100`,
        { credentials: "same-origin" }
      );
      if (!r.ok) throw new Error("Error al cargar bitácora del documento");
      return r.json() as Promise<{ data: { rows: BitacoraRow[]; total: number } }>;
    },
  });

  const auditRows = bitacoraData?.data.rows ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">Historial de versiones</CardTitle>
            <p className="text-xs text-muted-foreground font-normal">
              Cada versión conserva su archivo y el resumen de cambios de este documento.
            </p>
          </div>
          {versions.length >= 2 && (
            <Button size="sm" variant="outline" onClick={() => setCompareOpen(true)}>
              Comparar versiones
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2">Ver.</th>
                <th className="px-3 py-2">Archivo</th>
                <th className="px-3 py-2">Resumen de cambios</th>
                <th className="px-3 py-2">Revisión</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Subido por</th>
                <th className="px-3 py-2">Aprobado por</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {versions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                    Sin versiones registradas
                  </td>
                </tr>
              )}
              {versions.map((v) => {
                const isCurrent = v.id === currentVersionId;
                return (
                  <tr key={v.id} className="border-b align-top">
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-medium">{v.versionLabel}</span>
                      {isCurrent && (
                        <Badge variant="secondary" className="ml-2 text-[10px]">
                          Vigente
                        </Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 max-w-[10rem] truncate" title={v.fileName}>
                      {v.fileName}
                    </td>
                    <td className="px-3 py-2 max-w-xs whitespace-pre-wrap text-muted-foreground">
                      {v.changeSummary?.trim() || "—"}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(v.revisionDate)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {STATUS_LABELS[v.status] ?? v.status}
                    </td>
                    <td className="px-3 py-2">
                      <div>{v.uploadedBy.name}</div>
                      {v.createdAt && (
                        <div className="text-[11px] text-muted-foreground">
                          {formatDate(v.createdAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {v.approvedBy ? (
                        <>
                          <div>{v.approvedBy.name}</div>
                          {v.approvedAt && (
                            <div className="text-[11px] text-muted-foreground">
                              {formatDate(v.approvedAt)}
                            </div>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <a href={v.downloadUrl} className="text-teal-700 hover:underline text-xs">
                        Descargar
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bitácora de cambios</CardTitle>
          <p className="text-xs text-muted-foreground font-normal">
            Eventos de este documento: versiones, aprobaciones, solicitudes y ediciones.
          </p>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Acción</th>
                <th className="px-3 py-2">Versión</th>
                <th className="px-3 py-2">Usuario</th>
                <th className="px-3 py-2">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {bitacoraLoading && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Cargando bitácora…
                  </td>
                </tr>
              )}
              {!bitacoraLoading && auditRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                    Aún no hay eventos registrados para este documento
                  </td>
                </tr>
              )}
              {auditRows.map((row) => (
                <tr key={row.id} className="border-b align-top">
                  <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                  <td className="px-3 py-2">{sigAuditActionLabel(row.action)}</td>
                  <td className="px-3 py-2">{row.version?.versionLabel ?? "—"}</td>
                  <td className="px-3 py-2">{row.actor.name}</td>
                  <td className="px-3 py-2 max-w-md whitespace-pre-wrap text-muted-foreground">
                    {row.notes?.trim() || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <DocumentVersionCompare
        documentId={documentId}
        versions={versions.map((v) => ({ id: v.id, versionLabel: v.versionLabel }))}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />
    </div>
  );
}
