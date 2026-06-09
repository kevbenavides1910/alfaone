"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Topbar } from "@/components/layout/Topbar";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/format";

const ACTION_LABELS: Record<string, string> = {
  CREATED: "Creado",
  UPDATED: "Actualizado",
  SUBMITTED_FOR_APPROVAL: "Enviado a aprobación",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  REVISION_DATE_UPDATED: "Fecha de revisión actualizada",
  NEW_VERSION: "Nueva versión",
  SAME_VERSION_UPDATED: "Vigencia actualizada (misma versión)",
  OBSOLETED: "Obsoleto",
};

interface BitacoraRow {
  id: string;
  action: string;
  notes: string | null;
  createdAt: string;
  document: { id: string; code: string; title: string };
  version: { versionLabel: string } | null;
  actor: { name: string };
}

export default function SigBitacoraPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["sig-bitacora"],
    queryFn: async () => {
      const r = await fetch("/api/sig/bitacora?pageSize=50", { credentials: "same-origin" });
      if (!r.ok) throw new Error("Error al cargar bitácora");
      return r.json() as Promise<{ data: { rows: BitacoraRow[] } }>;
    },
  });

  const rows = data?.data.rows ?? [];

  return (
    <>
      <Topbar title="SIG — Bitácora de cambios y aprobaciones" />
      <div className="p-4 max-w-5xl mx-auto">
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Documento</th>
                  <th className="px-3 py-2">Acción</th>
                  <th className="px-3 py-2">Usuario</th>
                  <th className="px-3 py-2">Notas</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      Cargando…
                    </td>
                  </tr>
                )}
                {rows.map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/sig/documentos/${row.document.id}`} className="text-teal-800 hover:underline">
                        {row.document.code}
                      </Link>
                      {row.version && (
                        <span className="text-muted-foreground ml-1">v{row.version.versionLabel}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{ACTION_LABELS[row.action] ?? row.action}</td>
                    <td className="px-3 py-2">{row.actor.name}</td>
                    <td className="px-3 py-2 text-muted-foreground max-w-xs truncate">
                      {row.notes ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
