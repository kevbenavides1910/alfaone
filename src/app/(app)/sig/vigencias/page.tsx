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

type Reminder = {
  documentId: string;
  code: string;
  title: string;
  revisionIntervalDays: number;
  lastRevisionDate: string;
  nextRevisionDue: string;
  daysUntilDue: number;
  isOverdue: boolean;
};

export default function SigVigenciasPage() {
  const [withinDays, setWithinDays] = useState(30);
  const { data, isLoading } = useQuery({
    queryKey: ["sig-vigencias", withinDays],
    queryFn: async () => {
      const r = await fetch(`/api/sig/revision-reminders?withinDays=${withinDays}`, {
        credentials: "same-origin",
      });
      if (!r.ok) throw new Error("Error al cargar vigencias");
      return r.json() as Promise<{ data: Reminder[] }>;
    },
  });

  const rows = data?.data ?? [];
  const overdue = rows.filter((r) => r.isOverdue);
  const upcoming = rows.filter((r) => !r.isOverdue);

  return (
    <>
      <Topbar title="SIG — Vigencias y revisiones" />
      <div className="p-4 max-w-5xl mx-auto space-y-4">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle className="text-base">Documentos por renovar</CardTitle>
              <p className="text-xs text-muted-foreground font-normal mt-1">
                Según intervalo de revisión y fecha de la versión vigente.
              </p>
            </div>
            <div className="w-36">
              <Label className="text-xs">Ventana (días)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={withinDays}
                onChange={(e) => setWithinDays(Number(e.target.value) || 30)}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-3 text-sm">
              <Badge variant="destructive">{overdue.length} vencidos</Badge>
              <Badge variant="secondary">{upcoming.length} próximos</Badge>
            </div>

            {isLoading && <p className="text-sm text-muted-foreground">Cargando…</p>}

            {!isLoading && rows.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hay documentos por revisar en esta ventana.
              </p>
            )}

            {rows.length > 0 && (
              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-2">Código</th>
                      <th className="px-3 py-2">Título</th>
                      <th className="px-3 py-2">Última revisión</th>
                      <th className="px-3 py-2">Próxima</th>
                      <th className="px-3 py-2">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.documentId} className="border-b">
                        <td className="px-3 py-2 font-mono text-xs">
                          <Link
                            href={`/sig/documentos/${r.documentId}#procedimiento`}
                            className="text-teal-800 hover:underline"
                          >
                            {r.code}
                          </Link>
                        </td>
                        <td className="px-3 py-2">{r.title}</td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(r.lastRevisionDate)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {formatDate(r.nextRevisionDue)}
                        </td>
                        <td className="px-3 py-2">
                          {r.isOverdue ? (
                            <Badge variant="destructive">
                              Vencido {Math.abs(r.daysUntilDue)} d
                            </Badge>
                          ) : (
                            <Badge variant="outline">En {r.daysUntilDue} d</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
