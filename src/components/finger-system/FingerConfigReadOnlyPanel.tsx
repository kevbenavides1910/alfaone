"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Settings = {
  attReadOnly: boolean;
  attWindowsPath: string | null;
  attSmbShare: string | null;
  attSmbUser: string | null;
  attSmbPasswordSet: boolean;
  attDatabaseName: string | null;
  attAccessUser: string | null;
  attBlankPassword: boolean;
  attDriveMappings: { letter: string; uncPath: string; label: string }[] | null;
  linkRrhhEmployees: boolean;
  smbConfigured: boolean;
  syncAutoEnabled: boolean;
  syncIntervalMinutes: number;
  lastAutoSyncAt: string | null;
  discoveryDefaultPort: number;
  backupPath: string | null;
};

export function FingerConfigReadOnlyPanel() {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Configuración actual (solo lectura)</CardTitle>
        <p className="text-sm text-slate-500">
          Su rol permite consultar la configuración biométrica. Para cambiar la ruta ATT2016 o
          ajustes del sistema solicite permiso de administración biométrica.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? <p className="text-slate-500">Cargando…</p> : null}
        {isError ? (
          <p className="text-red-600">No fue posible cargar la configuración.</p>
        ) : null}
        {settings ? (
          <>
            <Row label="Ruta Windows (Access)" value={settings.attWindowsPath ?? "—"} mono />
            <Row label="Share SMB (servidor)" value={settings.attSmbShare ?? "—"} mono />
            <Row label="Usuario de red SMB" value={settings.attSmbUser ?? "—"} />
            <Row
              label="Contraseña de red"
              value={settings.attSmbPasswordSet ? "Guardada (cifrada)" : "No configurada"}
            />
            <Row label="Usuario Access" value={settings.attAccessUser ?? "Admin"} />
            <Row
              label="Contraseña Access"
              value={settings.attBlankPassword ? "En blanco" : "Configurada"}
            />
            <Row label="Archivo MDB" value={settings.attDatabaseName ?? "ATT2016.MDB"} mono />
            {Array.isArray(settings.attDriveMappings) && settings.attDriveMappings.length > 0 ? (
              <div className="space-y-0.5">
                <p className="font-medium text-slate-900">Mapeos de unidades:</p>
                {settings.attDriveMappings.map((m) => (
                  <p key={m.letter} className="font-mono text-xs text-slate-600">
                    {m.letter}: → {m.uncPath}
                  </p>
                ))}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge variant={settings.smbConfigured ? "default" : "secondary"}>
                Credenciales SMB: {settings.smbConfigured ? "configuradas" : "pendientes"}
              </Badge>
              <Badge variant={settings.attReadOnly ? "outline" : "destructive"}>
                ATT2016 {settings.attReadOnly ? "solo lectura" : "escritura"}
              </Badge>
              <Badge variant={settings.linkRrhhEmployees ? "default" : "secondary"}>
                RRHH Alfa One: {settings.linkRrhhEmployees ? "vinculado" : "independiente"}
              </Badge>
            </div>
            <Row
              label="Sync automática"
              value={
                settings.syncAutoEnabled
                  ? `Activa (${settings.syncIntervalMinutes} min)`
                  : "Inactiva"
              }
            />
            <Row
              label="Última sync auto"
              value={
                settings.lastAutoSyncAt
                  ? new Date(settings.lastAutoSyncAt).toLocaleString("es-CR")
                  : "Nunca"
              }
            />
            <Row label="Ruta backups" value={settings.backupPath ?? "—"} />
            <Row label="Puerto default TCP" value={String(settings.discoveryDefaultPort ?? 4370)} />
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <p className="text-slate-700">
      <span className="font-medium text-slate-900">{label}: </span>
      <span className={mono ? "font-mono text-xs" : undefined}>{value}</span>
    </p>
  );
}
