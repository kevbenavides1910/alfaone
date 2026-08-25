"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Settings = {
  attReadOnly: boolean;
  syncAutoEnabled: boolean;
  syncIntervalMinutes: number;
  lastAutoSyncAt: string | null;
  discoveryDefaultPort: number;
  backupPath: string | null;
};

export function FingerConfigAdminPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery<{ data: Settings }>({
    queryKey: ["finger-system-settings"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/settings", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar configuración");
      return json;
    },
  });

  const settings = data?.data;
  const [discoveryDefaultPort, setDiscoveryDefaultPort] = useState("");
  const [syncAutoEnabled, setSyncAutoEnabled] = useState<boolean | null>(null);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState("");
  const [backupPath, setBackupPath] = useState("");
  const [attReadOnly, setAttReadOnly] = useState<boolean | null>(null);

  useEffect(() => {
    if (!settings) return;
    setDiscoveryDefaultPort(String(settings.discoveryDefaultPort ?? 4370));
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error("Sin configuración");
      const res = await fetch("/api/finger-system/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discoveryDefaultPort: discoveryDefaultPort.trim()
            ? Number.parseInt(discoveryDefaultPort, 10)
            : settings.discoveryDefaultPort,
          syncAutoEnabled: syncAutoEnabled ?? settings.syncAutoEnabled,
          syncIntervalMinutes:
            syncIntervalMinutes.trim() !== ""
              ? Number.parseInt(syncIntervalMinutes, 10)
              : settings.syncIntervalMinutes,
          backupPath: backupPath.trim() !== "" ? backupPath : settings.backupPath,
          attReadOnly: attReadOnly ?? settings.attReadOnly,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al guardar");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["finger-system-diagnostic"] });
      setSyncAutoEnabled(null);
      setAttReadOnly(null);
    },
  });

  if (!settings) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sincronización y respaldos</CardTitle>
        <p className="text-sm text-slate-500">
          Ajustes avanzados del módulo biométrico. Requiere permiso admin en configuración.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="att-port">Puerto biométrico default (TCP)</Label>
          <Input
            id="att-port"
            type="number"
            min={1}
            max={65535}
            value={discoveryDefaultPort}
            onChange={(e) => setDiscoveryDefaultPort(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="syncAuto"
            type="checkbox"
            checked={syncAutoEnabled ?? settings.syncAutoEnabled}
            onChange={(e) => setSyncAutoEnabled(e.target.checked)}
          />
          <Label htmlFor="syncAuto">Sincronización automática (cron)</Label>
        </div>
        <div className="space-y-2">
          <Label>Intervalo (minutos)</Label>
          <Input
            type="number"
            min={5}
            max={1440}
            placeholder={String(settings.syncIntervalMinutes)}
            value={syncIntervalMinutes}
            onChange={(e) => setSyncIntervalMinutes(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Ruta backups</Label>
          <Input
            placeholder={settings.backupPath ?? "APP_DATA_ROOT/finger-backups"}
            value={backupPath}
            onChange={(e) => setBackupPath(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <input
            id="attReadOnly"
            type="checkbox"
            checked={attReadOnly ?? settings.attReadOnly}
            onChange={(e) => setAttReadOnly(e.target.checked)}
          />
          <Label htmlFor="attReadOnly">ATT2016 solo lectura</Label>
        </div>
        <p className="text-sm text-slate-600">
          Última sync auto:{" "}
          {settings.lastAutoSyncAt
            ? new Date(settings.lastAutoSyncAt).toLocaleString("es-CR")
            : "Nunca"}
        </p>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Guardando…" : "Guardar ajustes avanzados"}
        </Button>
        {saveMutation.isError ? (
          <p className="text-sm text-red-600">{(saveMutation.error as Error).message}</p>
        ) : null}
        {saveMutation.isSuccess ? (
          <p className="text-sm text-emerald-700">Ajustes guardados.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
