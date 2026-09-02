"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronRight,
  FolderInput,
  RefreshCw,
  Save,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
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

type OrgTreeNode = {
  id: string;
  label: string;
  type: "root" | "company" | "department";
  companyCode?: string;
  deptId?: number;
  children: OrgTreeNode[];
};

type ListResponse = {
  items: UnifiedEmployeeRow[];
  total: number;
};

type DeviceOption = {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  status: string;
};

type SelectionFilter = {
  nodeId: string;
  label: string;
  companyCode?: string;
  deptId?: number;
};

type DetailTab = "basica" | "reporte" | "bio";

const WIN = {
  frame: "border border-[#808080] bg-[#d4d0c8] shadow-sm",
  inset: "border border-[#808080] border-t-[#404040] border-l-[#404040] bg-white",
  panel: "bg-[#ece9d8]",
  title:
    "bg-gradient-to-r from-[#0a246a] via-[#1f4fa3] to-[#a6caf0] text-white text-sm font-semibold px-2 py-1",
  toolbar: "border-b border-[#808080] bg-[#ece9d8] px-1 py-1",
  status: "border-t border-[#808080] bg-[#ece9d8] px-2 py-0.5 text-[11px] text-[#000]",
  tabActive: "bg-white border border-b-0 border-[#808080] px-3 py-1 text-[11px] -mb-px z-10",
  tabIdle:
    "bg-[#ece9d8] border border-[#808080] border-b-0 px-3 py-1 text-[11px] text-[#000] hover:bg-[#f5f3ea]",
  group: "border border-[#808080] bg-[#ece9d8] p-2",
  gridHead: "bg-[#316ac5] text-white text-[11px]",
  gridRowSel: "bg-[#316ac5] text-white",
  gridRow: "bg-white hover:bg-[#e8f4ff] text-[11px]",
};

export function FingerUnifiedEmployeesWorkspace() {
  const queryClient = useQueryClient();
  const { canEditEmployees, canEditBiometrics } = useFingerPermissions();

  const [selectedNode, setSelectedNode] = useState<SelectionFilter>({
    nodeId: "root",
    label: "GRUPO ALFA",
  });
  const [includeSubDepts, setIncludeSubDepts] = useState(true);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<UnifiedEmployeeRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>("basica");
  const [enrollSource, setEnrollSource] = useState<"device" | "sensor" | "file">("device");

  const [formBadge, setFormBadge] = useState("");
  const [formName, setFormName] = useState("");
  const [formCedula, setFormCedula] = useState("");
  const [formGender, setFormGender] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formCard, setFormCard] = useState("");
  const [formPrivilege, setFormPrivilege] = useState("Usuario");
  const [formPhone, setFormPhone] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [enrollDeviceId, setEnrollDeviceId] = useState("");
  const [enrollFingerId, setEnrollFingerId] = useState("0");
  const [deviceConnected, setDeviceConnected] = useState<boolean | null>(null);

  const treeQuery = useQuery<{ data: OrgTreeNode }>({
    queryKey: ["finger-org-tree"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/org-tree", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar empresas");
      return json;
    },
  });

  const listQuery = useQuery<{ data: ListResponse }>({
    queryKey: ["finger-unified-employees", selectedNode, q, includeSubDepts],
    queryFn: async () => {
      const qs = new URLSearchParams({ page: "1", pageSize: "500" });
      if (q.trim()) qs.set("q", q.trim());
      if (selectedNode.companyCode) qs.set("company", selectedNode.companyCode);
      if (selectedNode.deptId != null) qs.set("deptId", String(selectedNode.deptId));
      if (includeSubDepts) qs.set("includeSubDepts", "true");
      const res = await fetch(`/api/finger-system/employees/unified?${qs}`, {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al listar empleados");
      return json;
    },
  });

  const devicesQuery = useQuery<{ data: { items: DeviceOption[] } }>({
    queryKey: ["finger-devices-picker"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/devices?pageSize=100", {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar dispositivos");
      return json;
    },
  });

  const employees = listQuery.data?.data.items ?? [];
  const total = listQuery.data?.data.total ?? employees.length;
  const devices = devicesQuery.data?.data.items ?? [];

  useEffect(() => {
    if (devices.length > 0 && !enrollDeviceId) setEnrollDeviceId(devices[0]!.id);
  }, [devices, enrollDeviceId]);

  useEffect(() => {
    if (!selectedEmployee && !isNew) return;
    const row = selectedEmployee;
    setFormBadge(row?.badgeNumber ?? "");
    setFormName(row?.name ?? "");
    setFormCedula(row?.cedula ?? row?.badgeNumber ?? "");
    setFormGender(row?.gender ?? "");
    setFormTitle(row?.title ?? row?.deptName ?? "");
    setFormCard(row?.badgeNumber ?? "");
  }, [selectedEmployee, isNew]);

  const resetForm = () => {
    setIsNew(false);
    setSelectedEmployee(null);
    setFormBadge("");
    setFormName("");
    setFormCedula("");
    setFormGender("");
    setFormTitle("");
    setFormCard("");
    setFormPhone("");
    setFormMobile("");
    setFormAddress("");
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
            card: formCard.trim() || undefined,
            privilege: formPrivilege === "Administrador" ? "14" : "0",
            pushToDevices: true,
            deptId: selectedNode.deptId ?? 1,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error?.message ?? "Error al crear");
        return json.data;
      }
      if (!selectedEmployee?.attUserId && !selectedEmployee?.badgeNumber) {
        throw new Error("Seleccione un empleado.");
      }
      const res = await fetch("/api/finger-system/employees/unified", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attUserId: selectedEmployee.attUserId,
          badgeNumber: formBadge.trim() || selectedEmployee.badgeNumber,
          name: formName.trim(),
          cedula: formCedula.trim() || undefined,
          pushToDevices: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al guardar");
      return json.data;
    },
    onSuccess: () => {
      setIsNew(false);
      queryClient.invalidateQueries({ queryKey: ["finger-unified-employees"] });
      queryClient.invalidateQueries({ queryKey: ["finger-org-tree"] });
    },
  });

  const connectDeviceMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await fetch(`/api/finger-system/devices/${deviceId}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "connect" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al conectar");
      return json.data as { status: string; message: string };
    },
    onSuccess: (data) => setDeviceConnected(data.status === "ONLINE"),
  });

  const enrollMutation = useMutation({
    mutationFn: async () => {
      if (enrollSource !== "device") {
        throw new Error("Solo enrolamiento en reloj ZK está disponible. Sensor USB y archivo no están soportados.");
      }
      if (!selectedEmployee?.attUserId) throw new Error("Seleccione un empleado.");
      if (!enrollDeviceId) throw new Error("Seleccione un dispositivo biométrico.");
      const body: Record<string, unknown> = {
        deviceId: enrollDeviceId,
        fingerId: Number.parseInt(enrollFingerId, 10),
        distribute: true,
      };
      if (selectedEmployee.employeeId) {
        body.employeeId = selectedEmployee.employeeId;
      } else {
        body.attUserId = selectedEmployee.attUserId;
        body.badgeNumber = formBadge.trim() || selectedEmployee.badgeNumber;
      }
      const res = await fetch("/api/finger-system/biometrics/enroll", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al enrolar");
      return json.data as { message?: string; templatesDistributed?: number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["finger-unified-employees"] });
      const dist = data?.templatesDistributed ?? 0;
      if (dist > 0) {
        // toast via mutation status message below
      }
    },
  });

  const pushDevicesMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee?.employeeId) {
        throw new Error("Se requiere vínculo RRHH (empleado vinculado) para enviar a relojes.");
      }
      const res = await fetch(`/api/finger-system/employees/${selectedEmployee.employeeId}/push-devices`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al enviar a relojes");
      return json.data as { okCount: number; results: Array<{ ok: boolean; deviceName: string; message: string }> };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-unified-employees"] }),
  });

  const selectedDevice = devices.find((d) => d.id === enrollDeviceId);

  return (
    <div className={`flex h-[calc(100vh-9.5rem)] min-h-[680px] flex-col ${WIN.frame}`}>
      <div className={WIN.title}>Lista Empleados</div>

      <div className={`${WIN.toolbar} flex flex-wrap items-center gap-0.5`}>
        <LegacyTool icon={<UserPlus className="h-5 w-5" />} label="Añadir" disabled={!canEditEmployees} onClick={() => { setIsNew(true); setSelectedEmployee(null); setDetailTab("basica"); }} />
        <LegacyTool icon={<Save className="h-5 w-5" />} label="Grabar" disabled={!canEditEmployees || (!isNew && !selectedEmployee)} onClick={() => saveMutation.mutate()} />
        <LegacyTool icon={<Trash2 className="h-5 w-5" />} label="Borrar" disabled={!canEditEmployees || !selectedEmployee} onClick={resetForm} />
        <LegacyTool icon={<X className="h-5 w-5" />} label="Cancela" onClick={resetForm} />
        <LegacyTool icon={<RefreshCw className="h-5 w-5" />} label="Actualizar" onClick={() => { listQuery.refetch(); treeQuery.refetch(); }} />
        <LegacyTool icon={<FolderInput className="h-5 w-5" />} label="Importar" disabled title="Próximamente" />

        <div className="mx-2 h-8 w-px bg-[#808080]" />

        <div className="flex items-center gap-1">
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && setQ(searchInput)}
            className={`h-7 w-40 text-[11px] ${WIN.inset}`}
            placeholder="Buscar…"
          />
          <LegacyTool icon={<Search className="h-4 w-4" />} label="Buscar" onClick={() => setQ(searchInput)} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={`w-[210px] shrink-0 ${WIN.inset} m-1 mr-0 flex flex-col`}>
          <label className="flex items-center gap-1 border-b border-[#c0c0c0] bg-[#ece9d8] px-1 py-0.5 text-[10px]">
            <input type="checkbox" checked={includeSubDepts} onChange={(e) => setIncludeSubDepts(e.target.checked)} />
            Incluir Sub Dpto.
          </label>
          <div className="min-h-0 flex-1 overflow-auto bg-white p-0.5">
            {treeQuery.data?.data ? (
              <OrgTree
                node={treeQuery.data.data}
                selectedId={selectedNode.nodeId}
                onSelect={(node) =>
                  setSelectedNode({
                    nodeId: node.id,
                    label: node.label,
                    companyCode: node.companyCode,
                    deptId: node.deptId,
                  })
                }
              />
            ) : (
              <p className="p-2 text-[10px] text-slate-500">Cargando…</p>
            )}
          </div>
        </aside>

        <div className="m-1 flex min-w-0 flex-1 flex-col">
          <div className={`min-h-0 flex-[0_0_42%] overflow-auto ${WIN.inset}`}>
            <table className="min-w-full border-collapse">
              <thead className={`sticky top-0 ${WIN.gridHead}`}>
                <tr>
                  {["AC-No.", "Cedula No.", "Nombre", "Género", "Título", "Movil/Pag.", "Huellas"].map((h) => (
                    <th key={h} className="border border-[#25589a] px-1.5 py-1 text-left font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {employees.map((row) => {
                  const selected = selectedEmployee?.id === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer ${selected ? WIN.gridRowSel : WIN.gridRow}`}
                      onClick={() => { setSelectedEmployee(row); setIsNew(false); setDetailTab("basica"); }}
                    >
                      <td className="border border-[#c0c0c0] px-1.5 py-0.5 font-mono">{row.badgeNumber}</td>
                      <td className="border border-[#c0c0c0] px-1.5 py-0.5 font-mono">{row.cedula ?? "—"}</td>
                      <td className="border border-[#c0c0c0] px-1.5 py-0.5">{row.name}</td>
                      <td className="border border-[#c0c0c0] px-1.5 py-0.5">{row.gender ?? "—"}</td>
                      <td className="border border-[#c0c0c0] px-1.5 py-0.5">{row.deptName ?? row.title ?? "—"}</td>
                      <td className="border border-[#c0c0c0] px-1.5 py-0.5">{formMobile || "—"}</td>
                      <td className="border border-[#c0c0c0] px-1.5 py-0.5 text-center tabular-nums">{row.fingerprintCount}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className={`mt-1 flex min-h-0 flex-1 flex-col ${WIN.inset}`}>
            <div className="flex border-b border-[#808080] bg-[#ece9d8] px-1 pt-1">
              {(
                [
                  ["basica", "Información Básica"],
                  ["reporte", "Reporte"],
                  ["bio", "Bio"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={detailTab === id ? WIN.tabActive : WIN.tabIdle}
                  onClick={() => setDetailTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-auto bg-white p-2">
              {detailTab === "basica" && (selectedEmployee || isNew) ? (
                <div className="grid gap-2 lg:grid-cols-[1fr_120px_240px]">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                    <LegacyField label="AC-No." value={formBadge} onChange={setFormBadge} disabled={!canEditEmployees} />
                    <LegacyField label="Género" value={formGender} onChange={setFormGender} disabled={!canEditEmployees} select={["", "Masculino", "Femenino"]} />
                    <LegacyField label="Nombre" value={formName} onChange={setFormName} disabled={!canEditEmployees} className="col-span-2" />
                    <LegacyField label="Cedula No." value={formCedula} onChange={setFormCedula} disabled={!canEditEmployees} />
                    <LegacyField label="Privilegio" value={formPrivilege} onChange={setFormPrivilege} disabled={!canEditEmployees} select={["Usuario", "Administrador", "Registrador"]} />
                    <LegacyField label="Título" value={formTitle} onChange={setFormTitle} disabled={!canEditEmployees} />
                    <LegacyField label="Num. Tarjeta" value={formCard} onChange={setFormCard} disabled={!canEditEmployees} />
                    <LegacyField label="Tel. empresa" value={formPhone} onChange={setFormPhone} disabled={!canEditEmployees} />
                    <LegacyField label="No. Celular" value={formMobile} onChange={setFormMobile} disabled={!canEditEmployees} />
                    <LegacyField label="Dirección" value={formAddress} onChange={setFormAddress} disabled={!canEditEmployees} className="col-span-2" />
                  </div>

                  <div className={`${WIN.group} flex flex-col items-center`}>
                    <div className="mb-1 flex h-[100px] w-[84px] items-center justify-center border border-[#808080] bg-white text-[10px] text-slate-400">
                      Foto
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4].map((i) => (
                        <button key={i} type="button" className="h-5 w-5 border border-[#808080] bg-[#ece9d8] text-[8px]">·</button>
                      ))}
                    </div>
                  </div>

                  <fieldset className={`${WIN.group} min-w-0`}>
                    <legend className="px-1 text-[11px]">Relojes ZKTeco</legend>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-[10px]">Dispositivo</Label>
                        <Select value={enrollDeviceId} onValueChange={(v) => { setEnrollDeviceId(v); setDeviceConnected(null); }}>
                          <SelectTrigger className="mt-0.5 h-7 text-[11px]">
                            <SelectValue placeholder="Seleccione…" />
                          </SelectTrigger>
                          <SelectContent>
                            {devices.map((d) => (
                              <SelectItem key={d.id} value={d.id} className="text-xs">
                                {d.name} · {d.status}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 w-full border-[#808080] bg-[#ece9d8] text-[11px] hover:bg-[#f5f3ea]"
                        disabled={!enrollDeviceId || connectDeviceMutation.isPending}
                        onClick={() => enrollDeviceId && connectDeviceMutation.mutate(enrollDeviceId)}
                      >
                        {deviceConnected === true ? "Disp. Conectado" : deviceConnected === false ? "Disp. Desconectado" : "Probar conexión"}
                      </Button>
                      <div className="space-y-1 text-[10px]">
                        <label className="flex items-center gap-1">
                          <input type="radio" name="fpSource" checked={enrollSource === "device"} onChange={() => setEnrollSource("device")} />
                          Reloj ZK (enrolar)
                        </label>
                        <label className="flex items-center gap-1 text-slate-400">
                          <input type="radio" name="fpSource" disabled checked={false} readOnly />
                          Sensor USB (no soportado)
                        </label>
                        <label className="flex items-center gap-1 text-slate-400">
                          <input type="radio" name="fpSource" disabled checked={false} readOnly />
                          Archivo (no soportado)
                        </label>
                      </div>
                      <div>
                        <Label className="text-[10px]">Dedo</Label>
                        <Select value={enrollFingerId} onValueChange={setEnrollFingerId}>
                          <SelectTrigger className="mt-0.5 h-7 text-[11px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FINGER_OPTIONS.map((f) => (
                              <SelectItem key={f.id} value={String(f.id)} className="text-xs">{f.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full bg-[#ece9d8] text-[11px] text-black hover:bg-[#d4d0c8]"
                        variant="outline"
                        disabled={
                          !canEditBiometrics ||
                          !selectedEmployee?.employeeId ||
                          isNew ||
                          pushDevicesMutation.isPending
                        }
                        onClick={() => pushDevicesMutation.mutate()}
                      >
                        {pushDevicesMutation.isPending ? "Enviando…" : "Enviar a relojes"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full bg-[#ece9d8] text-[11px] text-black hover:bg-[#d4d0c8]"
                        variant="outline"
                        disabled={!canEditBiometrics || !selectedEmployee?.attUserId || isNew || enrollMutation.isPending}
                        onClick={() => enrollMutation.mutate()}
                      >
                        {enrollMutation.isPending ? "Enrolando…" : "Enrolar huella"}
                      </Button>
                      {selectedEmployee?.fingerIds.length ? (
                        <p className="text-[10px] text-slate-600">
                          Registrados: {selectedEmployee.fingerIds.map((f) => fingerLabel(f)).join(", ")}
                        </p>
                      ) : null}
                      {enrollMutation.isSuccess ? (
                        <p className="text-[10px] text-emerald-700">
                          {(enrollMutation.data as { message?: string })?.message ?? "Enrolamiento enviado al reloj."}
                        </p>
                      ) : null}
                      {pushDevicesMutation.isSuccess ? (
                        <p className="text-[10px] text-emerald-700">
                          Enviado a {pushDevicesMutation.data.okCount}/{pushDevicesMutation.data.results.length} reloj(es).
                        </p>
                      ) : null}
                      {enrollMutation.isError ? <p className="text-[10px] text-red-700">{(enrollMutation.error as Error).message}</p> : null}
                      {pushDevicesMutation.isError ? (
                        <p className="text-[10px] text-red-700">{(pushDevicesMutation.error as Error).message}</p>
                      ) : null}
                      {saveMutation.isError ? <p className="text-[10px] text-red-700">{(saveMutation.error as Error).message}</p> : null}
                    </div>
                  </fieldset>
                </div>
              ) : null}

              {detailTab === "basica" && !selectedEmployee && !isNew ? (
                <p className="text-[11px] text-slate-500">Seleccione un empleado en la lista o pulse Añadir.</p>
              ) : null}

              {detailTab === "reporte" ? (
                <p className="text-[11px] text-slate-600">
                  Reporte de asistencia del empleado — disponible en el módulo Asistencia / Reportes.
                </p>
              ) : null}

              {detailTab === "bio" && selectedEmployee ? (
                <div className="text-[11px] space-y-1">
                  <p><strong>Huellas:</strong> {selectedEmployee.fingerprintCount}</p>
                  <p><strong>Dedos:</strong> {selectedEmployee.fingerIds.length ? selectedEmployee.fingerIds.map((f) => fingerLabel(f)).join(", ") : "Ninguno registrado"}</p>
                  <p><strong>USERID ATT2016:</strong> {selectedEmployee.attUserId}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className={WIN.status}>
        Record Count: {total}
        {selectedNode.label !== "GRUPO ALFA" ? ` · ${selectedNode.label}` : ""}
        {selectedDevice ? ` · ${selectedDevice.name}` : ""}
      </div>
    </div>
  );
}

function OrgTree({
  node,
  selectedId,
  onSelect,
  depth = 0,
}: {
  node: OrgTreeNode;
  selectedId: string;
  onSelect: (node: OrgTreeNode) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  const isSelected = node.id === selectedId;

  return (
    <div className="select-none">
      <button
        type="button"
        className={`flex w-full items-center gap-0.5 py-px text-left text-[11px] ${isSelected ? "bg-[#316ac5] text-white" : "text-black"}`}
        style={{ paddingLeft: `${depth * 14 + 2}px` }}
        onClick={() => {
          onSelect(node);
          if (hasChildren) setOpen((v) => !v);
        }}
      >
        {hasChildren ? (
          open ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />
        ) : (
          <span className="inline-block w-3" />
        )}
        <span className="truncate">{node.label}</span>
      </button>
      {open ? node.children.map((child) => (
        <OrgTree key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
      )) : null}
    </div>
  );
}

function LegacyTool({
  icon,
  label,
  onClick,
  disabled,
  title,
}: {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-[52px] w-[52px] flex-col items-center justify-center gap-0.5 rounded-sm border border-transparent text-[10px] text-[#000] hover:border-[#808080] hover:bg-[#f5f3ea] disabled:opacity-40"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function LegacyField({
  label,
  value,
  onChange,
  disabled,
  select,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  select?: string[];
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="mb-0.5 block text-[#000]">{label}</label>
      {select ? (
        <select
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-full border border-[#808080] bg-white px-1 text-[11px]"
        >
          {select.map((o) => (
            <option key={o} value={o}>{o || "—"}</option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-full border border-[#808080] bg-white px-1 text-[11px]"
        />
      )}
    </div>
  );
}
