"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

type Settings = {
  attReadOnly: boolean;
  attSmbShare: string | null;
  attDatabaseName: string | null;
  smbConfigured: boolean;
  syncAutoEnabled: boolean;
  syncIntervalMinutes: number;
  lastAutoSyncAt: string | null;
  discoveryDefaultPort: number;
  backupPath: string | null;
};

type ProbeResult = {
  reachable: boolean;
  configured: boolean;
  message: string;
  sharePath: string;
  databaseName: string;
};

export default function FingerConfiguracionPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery<{ data: Settings }>({
    queryKey: ["finger-system-settings"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/settings", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar configuración");
      return json;
    },
  });

  const settings = data?.data;
  const [attSmbShare, setAttSmbShare] = useState("");
  const [attDatabaseName, setAttDatabaseName] = useState("");
  const [discoveryDefaultPort, setDiscoveryDefaultPort] = useState("");
  const [syncAutoEnabled, setSyncAutoEnabled] = useState<boolean | null>(null);
  const [syncIntervalMinutes, setSyncIntervalMinutes] = useState("");
  const [backupPath, setBackupPath] = useState("");
  const [attReadOnly, setAttReadOnly] = useState<boolean | null>(null);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);

  useEffect(() => {
    if (!settings) return;
    setAttSmbShare(settings.attSmbShare ?? "");
    setAttDatabaseName(settings.attDatabaseName ?? "ATT2016.MDB");
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
          attSmbShare: attSmbShare.trim() || null,
          attDatabaseName: attDatabaseName.trim() || null,
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
      return json.data as Settings;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["finger-system-diagnostic"] });
      setSyncAutoEnabled(null);
      setAttReadOnly(null);
      setProbeResult(null);
    },
  });

  const probeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/settings/probe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attSmbShare: attSmbShare.trim() || null,
          attDatabaseName: attDatabaseName.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al probar conexión");
      return json.data as ProbeResult;
    },
    onSuccess: (result) => setProbeResult(result),
  });

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Configuración</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ruta de la base biométrica en red, sincronización y respaldos. Usuario/contraseña SMB vía
          variables de entorno del servidor.
        </p>
      </div>

      {isLoading ? <p className="text-slate-500">Cargando…</p> : null}
      {isError ? (
        <p className="text-red-600">No fue posible cargar la configuración de Finger System.</p>
      ) : null}

      {settings ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Base biométrica en red (ATT2016)</CardTitle>
              <p className="text-sm text-slate-500">
                Indique manualmente el share SMB y el archivo MDB. Ejemplo:{" "}
                <code className="text-xs">//10.1.1.3/DB-Biometrico</code> →{" "}
                <code className="text-xs">ATT2016.MDB</code>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="att-share">Share SMB (ruta de red)</Label>
                <Input
                  id="att-share"
                  value={attSmbShare}
                  onChange={(e) => setAttSmbShare(e.target.value)}
                  placeholder="//10.1.1.3/DB-Biometrico"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="att-db">Archivo MDB</Label>
                <Input
                  id="att-db"
                  value={attDatabaseName}
                  onChange={(e) => setAttDatabaseName(e.target.value)}
                  placeholder="ATT2016.MDB"
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="att-port">Puerto biométrico default (TCP)</Label>
                <Input
                  id="att-port"
                  type="number"
                  min={1}
                  max={65535}
                  value={discoveryDefaultPort}
                  onChange={(e) => setDiscoveryDefaultPort(e.target.value)}
                  placeholder="4370"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={settings.smbConfigured ? "default" : "secondary"}>
                  Credenciales SMB: {settings.smbConfigured ? "configuradas" : "pendientes en .env"}
                </Badge>
                <Badge variant={(attReadOnly ?? settings.attReadOnly) ? "outline" : "destructive"}>
                  {(attReadOnly ?? settings.attReadOnly) ? "Solo lectura" : "Escritura habilitada"}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => probeMutation.mutate()}
                  disabled={probeMutation.isPending || !attSmbShare.trim()}
                >
                  {probeMutation.isPending ? "Probando…" : "Probar conexión"}
                </Button>
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Guardando…" : "Guardar ruta ATT2016"}
                </Button>
              </div>

              {probeMutation.isError ? (
                <p className="text-sm text-red-600">{(probeMutation.error as Error).message}</p>
              ) : null}
              {probeResult ? (
                <p
                  className={`text-sm ${probeResult.reachable ? "text-emerald-700" : "text-amber-800"}`}
                >
                  {probeResult.message}
                </p>
              ) : null}
              {saveMutation.isError ? (
                <p className="text-sm text-red-600">{(saveMutation.error as Error).message}</p>
              ) : null}
              {saveMutation.isSuccess ? (
                <p className="text-sm text-emerald-700">Configuración ATT2016 guardada.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sincronización y respaldos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Row
                label="Última sync auto"
                value={
                  settings.lastAutoSyncAt
                    ? new Date(settings.lastAutoSyncAt).toLocaleString("es-CR")
                    : "Nunca"
                }
              />
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Guardando…" : "Guardar ajustes"}
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciales en el servidor (.env)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 font-mono text-xs text-slate-600">
          <p>ATT2016_SMB_USER — usuario del share</p>
          <p>ATT2016_SMB_PASSWORD — contraseña (obligatoria)</p>
          <p className="text-slate-500 pt-2">
            La ruta del share y el nombre del MDB se configuran arriba en la aplicación.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-slate-700">
      <span className="font-medium text-slate-900">{label}:</span> {value}
    </p>
  );
}
