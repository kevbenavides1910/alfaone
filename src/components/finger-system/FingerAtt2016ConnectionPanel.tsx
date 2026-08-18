"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, MoreHorizontal } from "lucide-react";
import { Label } from "@/components/ui/label";
import { FingerDriveMappingsEditor } from "@/components/finger-system/FingerDriveMappingsEditor";
import { useFingerPermissions } from "@/components/finger-system/use-finger-permissions";
import type { AttDriveMapping } from "@/modules/finger-system/integrations/att2016/path-resolver";

type Settings = {
  attWindowsPath: string | null;
  attSmbShare: string | null;
  attSmbUser: string | null;
  attSmbPasswordSet: boolean;
  attDatabaseName: string | null;
  attAccessUser: string | null;
  attBlankPassword: boolean;
  linkRrhhEmployees: boolean;
  smbConfigured: boolean;
};

type NetworkLocation = {
  letter: string;
  uncPath: string;
  label: string;
  source: string;
};

type BrowseResponse = {
  share: string;
  files: { name: string; sizeBytes: number | null }[];
};

type ProbeResult = {
  reachable: boolean;
  message: string;
  canReadDatabase?: boolean;
  canWriteShare?: boolean;
  resolvedShare?: string | null;
  resolvedDatabase?: string | null;
};

function smbCredentialsPayload(
  smbUser: string,
  smbPassword: string,
  passwordSet: boolean,
) {
  const payload: Record<string, string> = { attSmbUser: smbUser.trim() };
  if (smbPassword.trim()) payload.attSmbPassword = smbPassword;
  else if (!passwordSet) payload.attSmbPassword = "";
  return payload;
}

const WIN = {
  dialog: "border border-[#808080] bg-[#d4d0c8] shadow-lg",
  title:
    "bg-gradient-to-r from-[#0a246a] via-[#1f4fa3] to-[#a6caf0] text-white text-sm font-semibold px-2 py-1.5 flex items-center gap-2",
  body: "p-3 space-y-3",
  tabActive: "bg-[#d4d0c8] border border-b-0 border-[#808080] px-3 py-1 text-[11px] -mb-px relative z-10",
  tabIdle:
    "bg-[#ece9d8] border border-[#808080] border-b-0 px-3 py-1 text-[11px] hover:bg-[#f5f3ea]",
  field: "h-7 w-full border border-[#808080] bg-white px-2 text-[11px] font-mono",
  group: "border border-[#808080] bg-[#ece9d8] p-2 text-[11px]",
  btn: "min-w-[88px] h-7 border border-[#808080] bg-[#ece9d8] text-[11px] hover:bg-[#f5f3ea] px-3",
};

export function FingerAtt2016ConnectionPanel() {
  const queryClient = useQueryClient();
  const { canAdminConfig } = useFingerPermissions();
  const [tab, setTab] = useState<"proveedor" | "conexion" | "avanzado" | "all">("conexion");
  const [windowsPath, setWindowsPath] = useState("X:\\ATT2016.MDB");
  const [smbUser, setSmbUser] = useState("");
  const [smbPassword, setSmbPassword] = useState("");
  const [saveSmbPassword, setSaveSmbPassword] = useState(true);
  const [accessUser, setAccessUser] = useState("Admin");
  const [accessPassword, setAccessPassword] = useState("");
  const [blankPassword, setBlankPassword] = useState(true);
  const [linkRrhhEmployees, setLinkRrhhEmployees] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [selectedDrive, setSelectedDrive] = useState<NetworkLocation | null>(null);
  const [browseFiles, setBrowseFiles] = useState<BrowseResponse["files"]>([]);
  const [probeResult, setProbeResult] = useState<ProbeResult | null>(null);
  const [driveMappings, setDriveMappings] = useState<AttDriveMapping[]>([]);
  const [mappingsReady, setMappingsReady] = useState(false);

  const settingsQuery = useQuery<{ data: Settings }>({
    queryKey: ["finger-system-settings"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/settings", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar");
      return json;
    },
  });

  const networkQuery = useQuery<{
    data: { locations: NetworkLocation[]; serverNote: string };
  }>({
    queryKey: ["finger-network-locations"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/settings/network-locations", {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar unidades");
      return json;
    },
    enabled: canAdminConfig,
  });

  const settings = settingsQuery.data?.data;
  const locations = networkQuery.data?.data.locations ?? [];

  useEffect(() => {
    if (!settings) return;
    setWindowsPath(settings.attWindowsPath ?? "X:\\ATT2016.MDB");
    setSmbUser(settings.attSmbUser ?? "");
    setAccessUser(settings.attAccessUser ?? "Admin");
    setBlankPassword(settings.attBlankPassword ?? true);
    setLinkRrhhEmployees(settings.linkRrhhEmployees ?? false);
  }, [settings]);

  useEffect(() => {
    if (mappingsReady || locations.length === 0) return;
    setDriveMappings(
      locations.map(({ letter, uncPath, label }) => ({ letter, uncPath, label })),
    );
    setMappingsReady(true);
  }, [locations, mappingsReady]);

  const browseMutation = useMutation({
    mutationFn: async (share: string) => {
      const passwordSet = settings?.attSmbPasswordSet ?? false;
      const useStored = passwordSet && !smbPassword.trim();
      if (useStored) {
        const qs = new URLSearchParams({ share });
        const res = await fetch(`/api/finger-system/settings/browse?${qs}`, {
          credentials: "same-origin",
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "No fue posible abrir la carpeta");
        return json.data as BrowseResponse;
      }
      const res = await fetch("/api/finger-system/settings/browse", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share,
          ...smbCredentialsPayload(smbUser, smbPassword, passwordSet),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "No fue posible abrir la carpeta");
      return json.data as BrowseResponse;
    },
    onSuccess: (data) => setBrowseFiles(data.files),
  });

  const probeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/settings/probe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attWindowsPath: windowsPath.trim(),
          attAccessUser: accessUser,
          attBlankPassword: blankPassword,
          attDriveMappings: driveMappings,
          ...smbCredentialsPayload(smbUser, smbPassword, settings?.attSmbPasswordSet ?? false),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al probar");
      return json.data as ProbeResult;
    },
    onSuccess: (data) => setProbeResult(data),
  });

  const saveMutation = useMutation({
    mutationFn: async (payload?: { mappingsOnly?: boolean }) => {
      const passwordSet = settings?.attSmbPasswordSet ?? false;
      if (!payload?.mappingsOnly) {
        if (!smbUser.trim()) throw new Error("Indique el usuario de red SMB.");
        if (!smbPassword.trim() && !passwordSet) {
          throw new Error("Indique la contraseña de red SMB.");
        }
      }

      const smbPatch =
        saveSmbPassword && smbPassword.trim()
          ? { attSmbPassword: smbPassword.trim() }
          : {};

      const res = await fetch("/api/finger-system/settings", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          payload?.mappingsOnly
            ? { attDriveMappings: driveMappings }
            : {
                attWindowsPath: windowsPath.trim(),
                attAccessUser: accessUser.trim(),
                attBlankPassword: blankPassword,
                attSmbUser: smbUser.trim(),
                ...smbPatch,
                linkRrhhEmployees,
                attDriveMappings: driveMappings,
              },
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al guardar");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-system-settings"] });
      queryClient.invalidateQueries({ queryKey: ["finger-network-locations"] });
      queryClient.invalidateQueries({ queryKey: ["finger-att2016-machines-preview"] });
      setSmbPassword("");
    },
  });

  const resetForm = () => {
    settingsQuery.refetch();
    networkQuery.refetch();
    setMappingsReady(false);
    setProbeResult(null);
  };

  const pickDrive = (loc: NetworkLocation) => {
    setSelectedDrive(loc);
    browseMutation.mutate(loc.uncPath);
  };

  const pickFile = (fileName: string) => {
    const letter = selectedDrive?.letter ?? "X";
    setWindowsPath(`${letter}:\\${fileName}`);
    setShowBrowse(false);
  };

  if (!canAdminConfig) {
    return (
      <div className={`${WIN.dialog} max-w-lg`}>
        <div className={WIN.title}>Propiedades de vínculo de datos</div>
        <div className={WIN.body}>
          <p className="text-[11px] text-slate-700">
            Ruta configurada: <span className="font-mono">{settings?.attWindowsPath ?? "—"}</span>
          </p>
          <p className="text-[11px] text-slate-500">Solo lectura. Requiere permiso admin biométrico.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${WIN.dialog} max-w-2xl`}>
      <div className={WIN.title}>
        <span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-white/20 text-[10px]">
          MDB
        </span>
        Propiedades de vínculo de datos
      </div>

      <div className="border-b border-[#808080] bg-[#ece9d8] px-2 pt-2">
        <div className="flex gap-0.5">
          {(
            [
              ["proveedor", "Proveedor"],
              ["conexion", "Conexión"],
              ["avanzado", "Avanzado"],
              ["all", "All"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? WIN.tabActive : WIN.tabIdle}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={WIN.body}>
        {tab === "conexion" ? (
          <>
            <p className="text-[11px] font-semibold text-[#000]">
              Especifique las siguientes opciones para conectarse a los datos de Microsoft Access:
            </p>

            <div>
              <Label className="text-[11px]">1. Seleccione o escriba el nombre de una base de datos:</Label>
              <div className="mt-1 flex gap-1">
                <input
                  value={windowsPath}
                  onChange={(e) => setWindowsPath(e.target.value)}
                  className={`${WIN.field} flex-1`}
                  placeholder="X:\ATT2016.MDB"
                />
                <button
                  type="button"
                  className={`${WIN.btn} px-2`}
                  title="Examinar unidades de red"
                  onClick={() => {
                    setShowBrowse(true);
                    if (locations[0]) pickDrive(locations[0]);
                  }}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>

            <fieldset className={WIN.group}>
              <legend className="px-1">Credenciales de red (carpeta compartida SMB)</legend>
              <p className="mb-2 text-[10px] text-slate-600">
                Usuario de Windows con permiso de lectura y administración en el share (ej. DB-Biometrico).
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px]">Usuario de red:</Label>
                  <input
                    value={smbUser}
                    onChange={(e) => setSmbUser(e.target.value)}
                    className={`${WIN.field} mt-0.5`}
                    placeholder="DOMINIO\\usuario o usuario"
                    autoComplete="username"
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Contraseña de red:</Label>
                  <input
                    type="password"
                    value={smbPassword}
                    onChange={(e) => setSmbPassword(e.target.value)}
                    className={`${WIN.field} mt-0.5`}
                    placeholder={
                      settings?.attSmbPasswordSet ? "(guardada — escriba para cambiar)" : "Contraseña SMB"
                    }
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[10px]">
                <input
                  type="checkbox"
                  checked={saveSmbPassword}
                  onChange={(e) => setSaveSmbPassword(e.target.checked)}
                />
                Permitir guardar contraseña de red
              </label>
              {settings?.attSmbPasswordSet ? (
                <p className="mt-1 text-[10px] text-emerald-800">Contraseña de red guardada en el servidor (cifrada).</p>
              ) : (
                <p className="mt-1 text-[10px] text-amber-800">
                  Debe ingresar credenciales de red para probar y guardar la conexión.
                </p>
              )}
            </fieldset>

            <fieldset className={WIN.group}>
              <legend className="px-1">Información de inicio de sesión en la base de datos</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <Label className="text-[10px]">Nombre de usuario:</Label>
                  <input
                    value={accessUser}
                    onChange={(e) => setAccessUser(e.target.value)}
                    className={`${WIN.field} mt-0.5`}
                  />
                </div>
                <div>
                  <Label className="text-[10px]">Contraseña:</Label>
                  <input
                    type="password"
                    value={accessPassword}
                    disabled={blankPassword}
                    onChange={(e) => setAccessPassword(e.target.value)}
                    className={`${WIN.field} mt-0.5`}
                  />
                </div>
              </div>
              <label className="mt-2 flex items-center gap-2 text-[10px]">
                <input
                  type="checkbox"
                  checked={blankPassword}
                  onChange={(e) => setBlankPassword(e.target.checked)}
                />
                Contraseña en blanco
              </label>
              <label className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                <input type="checkbox" disabled />
                Permitir guardar contraseña
              </label>
            </fieldset>

            {networkQuery.data?.data.serverNote ? (
              <p className="text-[10px] text-slate-600">{networkQuery.data.data.serverNote}</p>
            ) : null}

            {probeResult ? (
              <div
                className={`text-[11px] ${probeResult.reachable ? "text-emerald-800" : "text-red-700"}`}
              >
                <p>{probeResult.message}</p>
                {probeResult.resolvedShare ? (
                  <span className="block font-mono text-[10px] text-slate-500">
                    → {probeResult.resolvedShare} / {probeResult.resolvedDatabase}
                  </span>
                ) : null}
                {probeResult.reachable && probeResult.canWriteShare === false ? (
                  <p className="mt-1 text-amber-800">
                    Advertencia: el usuario puede leer el MDB pero no tiene permiso de escritura en el share.
                  </p>
                ) : null}
              </div>
            ) : null}

            {saveMutation.isSuccess ? (
              <p className="text-[11px] text-emerald-800">Conexión guardada correctamente.</p>
            ) : null}
            {saveMutation.isError ? (
              <p className="text-[11px] text-red-700">{(saveMutation.error as Error).message}</p>
            ) : null}
          </>
        ) : null}

        {tab === "proveedor" ? (
          <p className="text-[11px]">Proveedor: Microsoft Jet OLEDB 4.0 / Access via SMB (Finger System)</p>
        ) : null}
        {tab === "avanzado" ? (
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={linkRrhhEmployees}
                onChange={(e) => setLinkRrhhEmployees(e.target.checked)}
              />
              Vincular empleados con RRHH Alfa One
            </label>

            {mappingsReady ? (
              <FingerDriveMappingsEditor value={driveMappings} onChange={setDriveMappings} />
            ) : (
              <p className="text-[11px] text-slate-500">Cargando mapeos de unidades…</p>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={WIN.btn}
                disabled={saveMutation.isPending || !mappingsReady}
                onClick={() => saveMutation.mutate({ mappingsOnly: true })}
              >
                {saveMutation.isPending ? "Guardando…" : "Guardar mapeos"}
              </button>
            </div>
          </div>
        ) : null}
        {tab === "all" ? (
          <div className="space-y-1 font-mono text-[10px] text-slate-600">
            <p>SMB share: {settings?.attSmbShare ?? "—"}</p>
            <p>Usuario red: {settings?.attSmbUser ?? smbUser ?? "—"}</p>
            <p>Contraseña red: {settings?.attSmbPasswordSet ? "guardada" : "pendiente"}</p>
            <p>Archivo: {settings?.attDatabaseName ?? "—"}</p>
            <p>Credenciales: {settings?.smbConfigured ? "configuradas en Finger System" : "pendientes"}</p>
            <p className="pt-1">Mapeos ({driveMappings.length}):</p>
            {driveMappings.map((m) => (
              <p key={m.letter}>
                {m.letter}: → {m.uncPath}
              </p>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#808080] bg-[#ece9d8] px-3 py-2">
        <button
          type="button"
          className={WIN.btn}
          disabled={probeMutation.isPending || !windowsPath.trim() || !smbUser.trim() || (!smbPassword.trim() && !settings?.attSmbPasswordSet)}
          onClick={() => probeMutation.mutate()}
        >
          {probeMutation.isPending ? "Probando…" : "Probar conexión"}
        </button>
        <button
          type="button"
          className={WIN.btn}
          disabled={saveMutation.isPending}
          onClick={() => saveMutation.mutate({})}
        >
          {saveMutation.isPending ? "Guardando…" : "Aceptar"}
        </button>
        <button type="button" className={WIN.btn} onClick={resetForm}>
          Cancelar
        </button>
        <button type="button" className={`${WIN.btn} min-w-[64px]`} disabled>
          Ayuda
        </button>
      </div>

      {showBrowse ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className={`${WIN.dialog} flex h-[420px] w-full max-w-3xl flex-col`}>
            <div className={WIN.title}>Examinar — Unidades de red</div>
            <div className="flex min-h-0 flex-1">
              <aside className="w-[280px] shrink-0 overflow-auto border-r border-[#808080] bg-white p-1">
                <p className="mb-1 px-1 text-[10px] font-semibold text-slate-600">Mis sitios de red</p>
                {locations.map((loc) => (
                  <button
                    key={loc.letter}
                    type="button"
                    className={`mb-0.5 flex w-full items-start gap-1 px-1 py-1 text-left text-[11px] ${
                      selectedDrive?.letter === loc.letter ? "bg-[#316ac5] text-white" : "hover:bg-[#e8f4ff]"
                    }`}
                    onClick={() => pickDrive(loc)}
                  >
                    <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      <strong>{loc.letter}:</strong> {loc.label}
                    </span>
                  </button>
                ))}
              </aside>
              <div className="min-w-0 flex-1 overflow-auto bg-white p-2">
                <p className="mb-2 text-[10px] text-slate-500">
                  {selectedDrive
                    ? `${selectedDrive.letter}:\\ → ${selectedDrive.uncPath}`
                    : "Seleccione una unidad"}
                </p>
                {browseMutation.isPending ? (
                  <p className="text-[11px]">Leyendo archivos…</p>
                ) : null}
                {browseMutation.isError ? (
                  <p className="text-[11px] text-red-700">{(browseMutation.error as Error).message}</p>
                ) : null}
                <div className="space-y-0.5">
                  {browseFiles.map((f) => (
                    <button
                      key={f.name}
                      type="button"
                      className="block w-full border border-transparent px-2 py-1 text-left font-mono text-[11px] hover:border-[#808080] hover:bg-[#ece9d8]"
                      onDoubleClick={() => pickFile(f.name)}
                      onClick={() => pickFile(f.name)}
                    >
                      {f.name}
                      {f.sizeBytes != null ? (
                        <span className="ml-2 text-slate-400">
                          ({Math.round(f.sizeBytes / 1024 / 1024)} MB)
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#808080] bg-[#ece9d8] px-3 py-2">
              <button type="button" className={WIN.btn} onClick={() => setShowBrowse(false)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
