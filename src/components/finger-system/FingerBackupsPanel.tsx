"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type BackupEntry = {
  folderName: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
  files: string[];
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FingerBackupsPanel() {
  const queryClient = useQueryClient();
  const [restoreFolder, setRestoreFolder] = useState("");
  const [confirmToken, setConfirmToken] = useState("");

  const listQuery = useQuery<{ data: { root: string; items: BackupEntry[] } }>({
    queryKey: ["finger-backups"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/backups", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al listar respaldos");
      return json;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/backups/create", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al crear respaldo");
      return json.data as BackupEntry;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-backups"] }),
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/backups/restore", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderName: restoreFolder, confirmToken }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al restaurar");
      return json.data as { preBackupFolder: string };
    },
    onSuccess: () => {
      setConfirmToken("");
      queryClient.invalidateQueries({ queryKey: ["finger-backups"] });
    },
  });

  const data = listQuery.data?.data;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Respaldos ATT2016</CardTitle>
          <p className="mt-1 text-sm text-slate-500">
            Copia de ATT2016.MDB vía SMB. La restauración crea un pre-respaldo automático y requiere
            desactivar modo solo lectura.
          </p>
        </div>
        <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
          {createMutation.isPending ? "Creando…" : "Crear respaldo ahora"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {data ? <p className="text-xs font-mono text-slate-500">Ruta: {data.root}</p> : null}

        {createMutation.isSuccess ? (
          <p className="text-sm text-emerald-700">
            Respaldo creado: {createMutation.data.folderName} ({formatSize(createMutation.data.sizeBytes)})
          </p>
        ) : null}
        {createMutation.isError ? (
          <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
        ) : null}
        {listQuery.isError ? (
          <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
        ) : null}

        <div className="overflow-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Carpeta</th>
                <th className="px-3 py-2 text-left font-medium">Fecha</th>
                <th className="px-3 py-2 text-left font-medium">Tamaño</th>
                <th className="px-3 py-2 text-left font-medium">Archivos</th>
                <th className="px-3 py-2 text-left font-medium">Restaurar</th>
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((b) => (
                <tr key={b.folderName} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{b.folderName}</td>
                  <td className="px-3 py-2 text-xs">{new Date(b.createdAt).toLocaleString("es-CR")}</td>
                  <td className="px-3 py-2">{formatSize(b.sizeBytes)}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {b.files.map((f) => (
                        <Badge key={f} variant="outline">
                          {f}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setRestoreFolder(b.folderName);
                        setConfirmToken("");
                      }}
                    >
                      Seleccionar
                    </Button>
                  </td>
                </tr>
              ))}
              {(data?.items.length ?? 0) === 0 && !listQuery.isLoading ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-500">
                    Sin respaldos. Configure credenciales de red SMB y cree el primero.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {restoreFolder ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
            <p className="text-sm font-medium text-amber-900">
              Restaurar respaldo: <span className="font-mono">{restoreFolder}</span>
            </p>
            <p className="text-xs text-amber-800">
              Se creará un pre-respaldo antes de subir el MDB al share SMB. Detenga Attendance Management
              en Windows si es posible.
            </p>
            <div className="space-y-2">
              <Label>Escriba el nombre exacto de la carpeta para confirmar</Label>
              <Input value={confirmToken} onChange={(e) => setConfirmToken(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button
                variant="destructive"
                disabled={restoreMutation.isPending || confirmToken !== restoreFolder}
                onClick={() => restoreMutation.mutate()}
              >
                {restoreMutation.isPending ? "Restaurando…" : "Confirmar restauración"}
              </Button>
              <Button variant="ghost" onClick={() => setRestoreFolder("")}>
                Cancelar
              </Button>
            </div>
            {restoreMutation.isSuccess ? (
              <p className="text-sm text-emerald-700">
                Restaurado. Pre-respaldo: {restoreMutation.data.preBackupFolder}
              </p>
            ) : null}
            {restoreMutation.isError ? (
              <p className="text-sm text-red-600">{(restoreMutation.error as Error).message}</p>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
