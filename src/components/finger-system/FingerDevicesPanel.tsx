"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FingerCompanyFilterHint } from "@/components/finger-system/FingerCompanyFilterHint";
import { fingerApiUrl, useFingerCompany } from "@/components/finger-system/finger-company-context";
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
  ONLINE: "En línea",
  OFFLINE: "Fuera de línea",
  ERROR: "Error",
  UNKNOWN: "Sin verificar",
};

const STATUS_TONE: Record<string, string> = {
  ONLINE: "bg-emerald-100 text-emerald-800",
  OFFLINE: "bg-slate-100 text-slate-700",
  ERROR: "bg-red-100 text-red-800",
  UNKNOWN: "bg-amber-100 text-amber-800",
};

export function FingerDevicesPanel() {
  const queryClient = useQueryClient();
  const { companyCode } = useFingerCompany();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
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

  const probeOneMutation = useMutation({
    mutationFn: async (payload: { id: string; action: string }) => {
      const res = await fetch(`/api/finger-system/devices/${payload.id}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: payload.action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error en dispositivo");
      return json.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-devices"] }),
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

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Dispositivos registrados</CardTitle>
            <p className="mt-1 text-sm text-slate-500">
              Relojes en red. Use Editar para cambiar IP, puerto o ubicación.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => probeAllMutation.mutate()}
              disabled={probeAllMutation.isPending}
            >
              {probeAllMutation.isPending ? "Verificando…" : "Verificar todos"}
            </Button>
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

          {listQuery.isError ? (
            <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
          ) : null}

          {data ? (
            <>
              <div className="overflow-auto rounded-lg border">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Nombre</th>
                      <th className="px-3 py-2 text-left font-medium">Empresa</th>
                      <th className="px-3 py-2 text-left font-medium">IP:Puerto</th>
                      <th className="px-3 py-2 text-left font-medium">Serial</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                      <th className="px-3 py-2 text-left font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((row) =>
                      editingId === row.id ? (
                        <tr key={row.id} className="border-t bg-slate-50">
                          <td colSpan={6} className="px-3 py-3">
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
                        <tr key={row.id} className="border-t">
                          <td className="px-3 py-2">
                            <div>{row.name}</div>
                            {row.location ? (
                              <div className="text-xs text-slate-500">{row.location}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.company ?? "—"}</td>
                          <td className="px-3 py-2 font-mono">
                            {row.ipAddress}:{row.port}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs">{row.serialNumber ?? "—"}</td>
                          <td className="px-3 py-2">
                            <Badge className={STATUS_TONE[row.status] ?? ""}>
                              {STATUS_LABEL[row.status] ?? row.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setEditingId(row.id)}
                              >
                                Editar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={probeOneMutation.isPending}
                                onClick={() => probeOneMutation.mutate({ id: row.id, action: "probe" })}
                              >
                                Verificar
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={probeOneMutation.isPending}
                                onClick={() =>
                                  probeOneMutation.mutate({ id: row.id, action: "pull-users" })
                                }
                              >
                                Usuarios ZK
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={probeOneMutation.isPending}
                                onClick={() =>
                                  probeOneMutation.mutate({ id: row.id, action: "pull-attendance" })
                                }
                              >
                                Marcas ZK
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
                            </div>
                          </td>
                        </tr>
                      ),
                    )}
                    {data.items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                          Sin dispositivos. Importe desde ATT2016 o agregue manualmente.
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
