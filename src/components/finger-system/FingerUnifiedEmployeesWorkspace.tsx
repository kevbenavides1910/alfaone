"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Save, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FINGER_OPTIONS, fingerLabel } from "@/modules/finger-system/config/finger-biometrics.client";
import { useFingerPermissions } from "@/components/finger-system/use-finger-permissions";
import type { UnifiedEmployeeRow } from "@/modules/finger-system/services/finger-unified-employees";

type ListResponse = {
  items: UnifiedEmployeeRow[];
  total: number;
  source?: string;
};

type DeviceOption = {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: string;
};

export function FingerUnifiedEmployeesWorkspace() {
  const queryClient = useQueryClient();
  const { canEditEmployees, canEditBiometrics } = useFingerPermissions();

  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState<UnifiedEmployeeRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formBadge, setFormBadge] = useState("");
  const [formName, setFormName] = useState("");
  const [formCedula, setFormCedula] = useState("");
  const [formPrivilege, setFormPrivilege] = useState("Usuario");
  const [enrollDeviceId, setEnrollDeviceId] = useState("");
  const [enrollFingerId, setEnrollFingerId] = useState("0");
  const [message, setMessage] = useState<string | null>(null);

  const listQuery = useQuery<{ data: ListResponse }>({
    queryKey: ["finger-unified-employees", q],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: "1", pageSize: "500" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(`/api/finger-system/employees/unified?${qs}`, {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al listar");
      return json;
    },
  });

  const devicesQuery = useQuery<{ data: { items: DeviceOption[]; source?: string } }>({
    queryKey: ["finger-devices-for-enroll"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/devices?pageSize=50", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar relojes");
      return json;
    },
  });

  const devices = devicesQuery.data?.data.items ?? [];

  useEffect(() => {
    if (devices.length && !enrollDeviceId) setEnrollDeviceId(devices[0]!.id);
  }, [devices, enrollDeviceId]);

  useEffect(() => {
    if (isNew) {
      setFormBadge("");
      setFormName("");
      setFormCedula("");
      setFormPrivilege("Usuario");
      return;
    }
    setFormBadge(selected?.badgeNumber ?? "");
    setFormName(selected?.name ?? "");
    setFormCedula(selected?.cedula ?? "");
  }, [selected, isNew]);

  const reset = () => {
    setIsNew(false);
    setSelected(null);
    setMessage(null);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isNew) {
        if (!formName.trim()) throw new Error("Indique el nombre.");
        const res = await fetch("/api/finger-system/employees/unified", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            badgeNumber: formBadge.trim() || undefined,
            name: formName.trim(),
            cedula: formCedula.trim() || undefined,
            privilege: formPrivilege === "Administrador" ? "14" : "0",
            pushToDevices: true,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Error al crear");
        return json.data as { badgeNumber?: string; pushResults?: Array<{ ok: boolean }> };
      }
      if (!selected) throw new Error("Seleccione un usuario.");
      const res = await fetch("/api/finger-system/employees/unified", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badgeNumber: formBadge.trim() || selected.badgeNumber,
          attUserId: selected.attUserId,
          name: formName.trim(),
          cedula: formCedula.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al guardar");
      return json.data;
    },
    onSuccess: (data) => {
      setIsNew(false);
      queryClient.invalidateQueries({ queryKey: ["finger-unified-employees"] });
      const pushOk = (data as { pushResults?: Array<{ ok: boolean }> })?.pushResults?.filter((r) => r.ok)
        .length;
      setMessage(
        pushOk != null
          ? `Guardado. Enviado a ${pushOk} reloj(es).`
          : "Guardado.",
      );
    },
  });

  const pushMutation = useMutation({
    mutationFn: async () => {
      const badge = formBadge.trim() || selected?.badgeNumber;
      if (!badge) throw new Error("Falta código/badge.");
      const res = await fetch("/api/finger-system/employees/unified", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          badgeNumber: badge,
          name: formName.trim() || selected?.name,
          pushToDevices: true,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al enviar");
      return json.data as { pushResults?: Array<{ ok: boolean; device: string; message: string }> };
    },
    onSuccess: (data) => {
      const ok = data.pushResults?.filter((r) => r.ok).length ?? 0;
      const fail = data.pushResults?.filter((r) => !r.ok).length ?? 0;
      setMessage(fail ? `Enviado a ${ok}; falló en ${fail}.` : `Enviado a ${ok} reloj(es).`);
    },
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (!enrollDeviceId) throw new Error("Seleccione un reloj.");
      const badge = formBadge.trim() || selected?.badgeNumber;
      if (!badge) throw new Error("Falta código/badge.");
      const body: Record<string, unknown> = {
        deviceId: enrollDeviceId,
        fingerId: Number.parseInt(enrollFingerId, 10),
        distribute: true,
      };
      if (selected?.employeeId) body.employeeId = selected.employeeId;
      else {
        body.attUserId = selected?.attUserId ?? Number.parseInt(badge, 10);
        body.badgeNumber = badge;
      }
      const res = await fetch("/api/finger-system/biometrics/enroll", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al enrolar");
      return json.data as { message?: string };
    },
    onSuccess: (data) => {
      setMessage(data?.message ?? "Enrolamiento enviado al reloj. Coloque el dedo cuando lo pida.");
      queryClient.invalidateQueries({ queryKey: ["finger-unified-employees"] });
    },
  });

  const rows = listQuery.data?.data.items ?? [];
  const source = listQuery.data?.data.source;

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[560px] flex-col gap-3 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Usuarios biométricos</h1>
          <p className="text-sm text-muted-foreground">
            Padrón Odoo · alta, envío a relojes y enrolamiento de huella
            {source === "odoo" ? "" : " (fuente local)"}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => listQuery.refetch()}
            disabled={listQuery.isFetching}
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${listQuery.isFetching ? "animate-spin" : ""}`} />
            Actualizar
          </Button>
          <Button
            size="sm"
            disabled={!canEditEmployees}
            onClick={() => {
              setIsNew(true);
              setSelected(null);
              setMessage(null);
            }}
          >
            <UserPlus className="mr-1 h-3.5 w-3.5" />
            Añadir
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[1fr_340px]">
        <div className="flex min-h-0 flex-col rounded-xl border bg-card overflow-hidden">
          <div className="flex gap-2 border-b p-2">
            <Input
              className="h-8"
              placeholder="Buscar nombre, badge o cédula…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") setQ(searchInput);
              }}
            />
            <Button size="sm" variant="secondary" onClick={() => setQ(searchInput)}>
              Buscar
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/80 text-left text-xs">
                <tr>
                  <th className="px-3 py-2 font-medium">Código</th>
                  <th className="px-3 py-2 font-medium">Nombre</th>
                  <th className="px-3 py-2 font-medium">Cédula</th>
                </tr>
              </thead>
              <tbody>
                {listQuery.isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      Cargando…
                    </td>
                  </tr>
                ) : null}
                {!listQuery.isLoading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-muted-foreground">
                      Sin usuarios. Pulse Añadir o revise la conexión Odoo.
                    </td>
                  </tr>
                ) : null}
                {rows.map((row) => {
                  const active = !isNew && selected?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`border-t cursor-pointer ${active ? "bg-primary/10" : "hover:bg-muted/50"}`}
                      onClick={() => {
                        setIsNew(false);
                        setSelected(row);
                        setMessage(null);
                      }}
                    >
                      <td className="px-3 py-2 font-mono text-xs">{row.badgeNumber}</td>
                      <td className="px-3 py-2">{row.name ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{row.cedula ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t px-3 py-1.5 text-xs text-muted-foreground">
            {listQuery.data?.data.total ?? 0} usuario(s)
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4 space-y-3 overflow-auto">
          {!isNew && !selected ? (
            <p className="text-sm text-muted-foreground">Seleccione un usuario o pulse Añadir.</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold">{isNew ? "Nuevo usuario" : "Detalle"}</h2>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={reset}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs">Código (badge)</Label>
                  <Input
                    className="h-8"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder={isNew ? "Vacío = siguiente automático" : ""}
                    disabled={!canEditEmployees || (!isNew && !!selected)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nombre</Label>
                  <Input
                    className="h-8"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    disabled={!canEditEmployees}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cédula</Label>
                  <Input
                    className="h-8"
                    value={formCedula}
                    onChange={(e) => setFormCedula(e.target.value)}
                    disabled={!canEditEmployees}
                  />
                </div>
                {isNew ? (
                  <div className="space-y-1">
                    <Label className="text-xs">Perfil en reloj</Label>
                    <Select value={formPrivilege} onValueChange={setFormPrivilege}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Usuario">Usuario</SelectItem>
                        <SelectItem value="Administrador">Administrador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!canEditEmployees || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  <Save className="mr-1 h-3.5 w-3.5" />
                  {saveMutation.isPending ? "Guardando…" : "Grabar"}
                </Button>
                {!isNew ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={!canEditEmployees || pushMutation.isPending}
                    onClick={() => pushMutation.mutate()}
                  >
                    {pushMutation.isPending ? "Enviando…" : "Enviar a relojes"}
                  </Button>
                ) : null}
              </div>

              {!isNew ? (
                <div className="space-y-2 border-t pt-3">
                  <p className="text-xs font-medium">Enrolar huella</p>
                  <div className="space-y-1">
                    <Label className="text-xs">Reloj</Label>
                    <Select value={enrollDeviceId} onValueChange={setEnrollDeviceId}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="Seleccione…" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name} · {d.status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Dedo</Label>
                    <Select value={enrollFingerId} onValueChange={setEnrollFingerId}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FINGER_OPTIONS.map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    disabled={!canEditBiometrics || enrollMutation.isPending || !enrollDeviceId}
                    onClick={() => enrollMutation.mutate()}
                  >
                    {enrollMutation.isPending ? "Enrolando…" : `Enrolar (${fingerLabel(Number(enrollFingerId))})`}
                  </Button>
                </div>
              ) : null}

              {message ? <p className="text-xs text-emerald-700">{message}</p> : null}
              {saveMutation.isError ? (
                <p className="text-xs text-red-600">{(saveMutation.error as Error).message}</p>
              ) : null}
              {pushMutation.isError ? (
                <p className="text-xs text-red-600">{(pushMutation.error as Error).message}</p>
              ) : null}
              {enrollMutation.isError ? (
                <p className="text-xs text-red-600">{(enrollMutation.error as Error).message}</p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
