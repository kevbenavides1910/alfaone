"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FingerCompanyFilterHint } from "@/components/finger-system/FingerCompanyFilterHint";
import { fingerApiUrl, useFingerCompany } from "@/components/finger-system/finger-company-context";
import { useFingerPermissions } from "@/components/finger-system/use-finger-permissions";
import type { FingerDeviceRow } from "@/modules/finger-system/services/finger-devices";
import type { AttMachineImportPreview } from "@/modules/finger-system/services/att2016-machines-import";

type ListResponse = {
  items: FingerDeviceRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const STATUS_LABEL: Record<string, string> = {
  ONLINE: "Conectado",
  OFFLINE: "Desconectado",
  ERROR: "Error",
  UNKNOWN: "Sin verificar",
};

const STATUS_TONE: Record<string, string> = {
  ONLINE: "text-emerald-700 font-medium",
  OFFLINE: "text-blue-700 font-medium",
  ERROR: "text-red-700 font-medium",
  UNKNOWN: "text-amber-700 font-medium",
};

export function FingerDevicesPanel() {
  const queryClient = useQueryClient();
  const { companyCode } = useFingerCompany();
  const { canEditDevices } = useFingerPermissions();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
  }, [companyCode]);

  const listQuery = useQuery<{ data: ListResponse }>({
    queryKey: ["finger-devices", q, page, companyCode],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: String(page), pageSize: "25" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(fingerApiUrl(`/api/finger-system/devices?${qs}`, companyCode), {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al listar");
      return json;
    },
  });

  const importPreviewQuery = useQuery<{ data: AttMachineImportPreview }>({
    queryKey: ["finger-att2016-machines-preview"],
    enabled: canEditDevices,
    queryFn: async () => {
      const res = await fetch("/api/finger-system/devices/att2016/preview", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al analizar ATT2016");
      return json;
    },
  });

  const probeAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/devices/probe-all", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al verificar dispositivos");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-devices"] });
      queryClient.invalidateQueries({ queryKey: ["finger-system-dashboard"] });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/devices/att2016/import", {
        method: "POST",
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al importar");
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-devices"] });
      queryClient.invalidateQueries({ queryKey: ["finger-att2016-machines-preview"] });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (id: string) => {
      setConnectingId(id);
      const res = await fetch(`/api/finger-system/devices/${id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al conectar");
      return json.data;
    },
    onSettled: () => setConnectingId(null),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-devices"] }),
  });

  const deviceActionMutation = useMutation({
    mutationFn: async (input: { id: string; action: "pull-users" | "pull-attendance" }) => {
      setConnectingId(input.id);
      const res = await fetch(`/api/finger-system/devices/${input.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: input.action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error en la acción");
      return { action: input.action, data: json.data };
    },
    onSettled: () => setConnectingId(null),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-devices"] });
      queryClient.invalidateQueries({ queryKey: ["finger-punches"] });
    },
  });

  const pullAllAttendanceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/devices/pull-all-attendance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al traer marcas");
      return json.data as {
        insertedTotal: number;
        results: Array<{ ok: boolean; inserted?: number; name: string; error?: string }>;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finger-devices"] });
      queryClient.invalidateQueries({ queryKey: ["finger-punches"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/finger-system/devices/${id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message ?? "Error al eliminar");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-devices"] }),
  });

  const data = listQuery.data?.data;
  const importPreview = importPreviewQuery.data?.data;

  return (
    <div className="space-y-4">
      {canEditDevices ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agregar reloj biométrico manualmente</CardTitle>
            <p className="text-sm text-slate-500">
              Registre cada equipo con nombre, dirección IP y puerto TCP (4370 por defecto en ZKTeco).
            </p>
          </CardHeader>
          <CardContent>
            <CreateDeviceForm
              companyCode={companyCode}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: ["finger-devices"] })}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Lista / Máquinas</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Relojes biométricos en red (TCP/IP). Conecte cada equipo para actualizar estado y contadores.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => probeAllMutation.mutate()}
              disabled={probeAllMutation.isPending}
            >
              {probeAllMutation.isPending ? "Conectando…" : "Conectar todos"}
            </Button>
            {canEditDevices ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => pullAllAttendanceMutation.mutate()}
                disabled={pullAllAttendanceMutation.isPending}
              >
                {pullAllAttendanceMutation.isPending ? "Trayendo…" : "Traer marcas (todos)"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Buscar por nombre, IP o serial…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="max-w-sm"
            />
            <FingerCompanyFilterHint />
          </div>

          {probeAllMutation.isSuccess ? (
            <p className="text-sm text-emerald-700">
              {probeAllMutation.data.online}/{probeAllMutation.data.total} dispositivos en línea.
            </p>
          ) : null}

          {pullAllAttendanceMutation.isSuccess ? (
            <p className="text-sm text-emerald-700">
              Marcas importadas: {pullAllAttendanceMutation.data.insertedTotal} (
              {pullAllAttendanceMutation.data.results.filter((r) => r.ok).length}/
              {pullAllAttendanceMutation.data.results.length} relojes OK).
            </p>
          ) : null}
          {pullAllAttendanceMutation.isError ? (
            <p className="text-sm text-red-600">{(pullAllAttendanceMutation.error as Error).message}</p>
          ) : null}
          {deviceActionMutation.isSuccess ? (
            <p className="text-sm text-emerald-700">
              {deviceActionMutation.data.action === "pull-users"
                ? "Usuarios traídos del reloj."
                : "Marcas traídas del reloj."}
            </p>
          ) : null}
          {deviceActionMutation.isError ? (
            <p className="text-sm text-red-600">{(deviceActionMutation.error as Error).message}</p>
          ) : null}

          {listQuery.isError ? (
            <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
          ) : null}

          {data ? (
            <>
              <div className="overflow-auto rounded-lg border">
                <table className="min-w-[1200px] w-full text-xs">
                  <thead className="bg-blue-700 text-white">
                    <tr>
                      <th className="px-2 py-2 text-left font-medium">NombreDisp</th>
                      <th className="px-2 py-2 text-left font-medium">Estado</th>
                      <th className="px-2 py-2 text-left font-medium">TipoComm</th>
                      <th className="px-2 py-2 text-left font-medium">Dirrec. IP</th>
                      <th className="px-2 py-2 text-left font-medium">Puerta</th>
                      <th className="px-2 py-2 text-left font-medium">NombreProd</th>
                      <th className="px-2 py-2 text-right font-medium">CuentaUsu</th>
                      <th className="px-2 py-2 text-right font-medium">CuentaFP</th>
                      <th className="px-2 py-2 text-right font-medium">CuentaReg</th>
                      <th className="px-2 py-2 text-left font-medium">Número Serial</th>
                      <th className="px-2 py-2 text-left font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) =>
                      canEditDevices && editingId === row.id ? (
                        <tr key={row.id} className="border-t bg-slate-50">
                          <td colSpan={11} className="px-3 py-3">
                            <EditDeviceForm
                              device={row}
                              companyCode={companyCode}
                              onCancel={() => setEditingId(null)}
                              onSuccess={() => {
                                setEditingId(null);
                                queryClient.invalidateQueries({ queryKey: ["finger-devices"] });
                              }}
                            />
                          </td>
                        </tr>
                      ) : (
                        <tr key={row.id} className="border-t hover:bg-slate-50/80">
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                title="Conectar / actualizar"
                                disabled={connectMutation.isPending && connectingId === row.id}
                                onClick={() => connectMutation.mutate(row.id)}
                              >
                                <RefreshCw
                                  className={`h-3.5 w-3.5 ${connectingId === row.id ? "animate-spin" : ""}`}
                                />
                              </Button>
                              <span>{row.name}</span>
                            </div>
                          </td>
                          <td className={`px-2 py-2 ${STATUS_TONE[row.status] ?? ""}`}>
                            {STATUS_LABEL[row.status] ?? row.status}
                          </td>
                          <td className="px-2 py-2">TCP/IP</td>
                          <td className="px-2 py-2 font-mono">{row.ipAddress}</td>
                          <td className="px-2 py-2 font-mono">{row.port}</td>
                          <td className="px-2 py-2">{row.model ?? row.brand ?? "—"}</td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {row.employeeCount.toLocaleString("es-CR")}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {row.fingerprintCount.toLocaleString("es-CR")}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums">
                            {row.punchCount.toLocaleString("es-CR")}
                          </td>
                          <td className="px-2 py-2 font-mono">{row.serialNumber ?? "—"}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              {canEditDevices ? (
                                <Button variant="outline" size="sm" onClick={() => setEditingId(row.id)}>
                                  Editar
                                </Button>
                              ) : null}
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={connectMutation.isPending && connectingId === row.id}
                                onClick={() => connectMutation.mutate(row.id)}
                              >
                                {connectingId === row.id && connectMutation.isPending ? "…" : "Conectar"}
                              </Button>
                              {canEditDevices ? (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={deviceActionMutation.isPending && connectingId === row.id}
                                    onClick={() =>
                                      deviceActionMutation.mutate({ id: row.id, action: "pull-users" })
                                    }
                                  >
                                    Traer usuarios
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={deviceActionMutation.isPending && connectingId === row.id}
                                    onClick={() =>
                                      deviceActionMutation.mutate({ id: row.id, action: "pull-attendance" })
                                    }
                                  >
                                    Traer marcas
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600"
                                    disabled={deleteMutation.isPending}
                                    onClick={() => {
                                      if (confirm(`¿Eliminar ${row.name}?`)) deleteMutation.mutate(row.id);
                                    }}
                                  >
                                    Eliminar
                                  </Button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                    {data.items.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="px-3 py-6 text-center text-slate-500">
                          Sin dispositivos. Importe desde ATT2016 o agregue manualmente por IP.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              {data.totalPages > 1 ? (
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <span className="text-sm text-slate-600">
                    Página {data.page} de {data.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Siguiente
                  </Button>
                </div>
              ) : null}
            </>
          ) : listQuery.isLoading ? (
            <p className="text-sm text-slate-500">Cargando dispositivos…</p>
          ) : null}
        </CardContent>
      </Card>

      {canEditDevices ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Importar desde ATT2016</CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Tabla Machines de ATT2016.MDB (Piso 01, Piso 02, Alajuela, WELL, etc.).
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => importPreviewQuery.refetch()}
              disabled={importPreviewQuery.isFetching}
            >
              Actualizar
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {importPreviewQuery.isError ? (
              <p className="text-sm text-red-600">{(importPreviewQuery.error as Error).message}</p>
            ) : null}
            {importPreview ? (
              <>
                <div className="grid gap-3 sm:grid-cols-4">
                  <MiniStat label="En ATT2016" value={importPreview.attTotal} />
                  <MiniStat label="Importables" value={importPreview.importable} />
                  <MiniStat label="Sin IP" value={importPreview.missingIp} />
                  <MiniStat label="Ya registrados" value={importPreview.alreadyRegistered} />
                </div>
                <Button
                  onClick={() => importMutation.mutate()}
                  disabled={importMutation.isPending || importPreview.importable === 0}
                >
                  {importMutation.isPending
                    ? "Importando…"
                    : `Confirmar importación (${importPreview.importable})`}
                </Button>
                {importMutation.isSuccess ? (
                  <p className="text-sm text-emerald-700">
                    Importados {importMutation.data.rowsInserted}, actualizados{" "}
                    {importMutation.data.rowsUpdated}.
                  </p>
                ) : null}
              </>
            ) : importPreviewQuery.isLoading ? (
              <p className="text-sm text-slate-500">Analizando ATT2016…</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function CreateDeviceForm({ onSuccess, companyCode }: { onSuccess: () => void; companyCode: string | null }) {
  const [name, setName] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [port, setPort] = useState("4370");
  const [serialNumber, setSerialNumber] = useState("");
  const [location, setLocation] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/devices", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ipAddress: ipAddress.trim(),
          port: Number.parseInt(port, 10) || 4370,
          serialNumber: serialNumber.trim() || undefined,
          location: location.trim() || undefined,
          company: companyCode ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al crear");
      return json.data;
    },
    onSuccess: () => {
      setName("");
      setIpAddress("");
      setPort("4370");
      setSerialNumber("");
      setLocation("");
      onSuccess();
    },
  });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre del reloj" value={name} onChange={setName} placeholder="Piso 01" />
        <Field label="Dirección IP" value={ipAddress} onChange={setIpAddress} placeholder="10.1.1.80" />
        <Field label="Puerto TCP" value={port} onChange={setPort} placeholder="4370" />
        <Field label="Serial (opcional)" value={serialNumber} onChange={setSerialNumber} />
        <Field label="Ubicación (opcional)" value={location} onChange={setLocation} />
      </div>
      <Button
        size="sm"
        disabled={!name.trim() || !ipAddress.trim() || createMutation.isPending}
        onClick={() => createMutation.mutate()}
      >
        {createMutation.isPending ? "Guardando…" : "Registrar dispositivo"}
      </Button>
      {createMutation.isError ? (
        <p className="text-sm text-red-600">{(createMutation.error as Error).message}</p>
      ) : null}
      {createMutation.isSuccess ? (
        <p className="text-sm text-emerald-700">Dispositivo registrado correctamente.</p>
      ) : null}
    </div>
  );
}

function EditDeviceForm({
  device,
  companyCode,
  onSuccess,
  onCancel,
}: {
  device: FingerDeviceRow;
  companyCode: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(device.name);
  const [ipAddress, setIpAddress] = useState(device.ipAddress);
  const [port, setPort] = useState(String(device.port));
  const [serialNumber, setSerialNumber] = useState(device.serialNumber ?? "");
  const [location, setLocation] = useState(device.location ?? "");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/finger-system/devices/${device.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          ipAddress: ipAddress.trim(),
          port: Number.parseInt(port, 10) || 4370,
          serialNumber: serialNumber.trim() || null,
          location: location.trim() || null,
          company: companyCode ?? device.company,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al actualizar");
      return json.data;
    },
    onSuccess: () => onSuccess(),
  });

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Editar {device.name}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Nombre" value={name} onChange={setName} />
        <Field label="Dirección IP" value={ipAddress} onChange={setIpAddress} />
        <Field label="Puerto TCP" value={port} onChange={setPort} />
        <Field label="Serial" value={serialNumber} onChange={setSerialNumber} />
        <Field label="Ubicación" value={location} onChange={setLocation} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
          {updateMutation.isPending ? "Guardando…" : "Guardar cambios"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
      {updateMutation.isError ? (
        <p className="text-sm text-red-600">{(updateMutation.error as Error).message}</p>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
