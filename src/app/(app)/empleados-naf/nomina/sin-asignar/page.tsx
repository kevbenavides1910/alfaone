"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MultiSelect } from "@/components/ui/multi-select";
import { toast } from "@/components/ui/toaster";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import { formatCurrency, formatDate } from "@/lib/utils/format";

type EmpresaOption = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
};

type PeriodoOption = {
  ano: number;
  fDesde: string;
  fHasta: string;
  label: string;
};

type ContractOption = {
  id: string;
  licitacionNo: string;
  client: string;
  company: string;
  status: string;
};

type ManualAllocation = {
  id: string;
  contractId: string;
  devengado: number;
  deducciones: number;
  neto: number;
  contract: {
    id: string;
    licitacionNo: string;
    client: string;
    company: string;
  };
};

type EmpleadoRow = {
  noCia: string;
  companyLabel: string;
  noEmple: string;
  nombre: string | null;
  codPla: string;
  nominaNombre: string | null;
  noRol: string | null;
  contratoRrhh: string | null;
  licitacionNo: string | null;
  client: string | null;
  devengado: number;
  deducciones: number;
  neto: number;
  status: "pendiente" | "asignado_manual";
  manualAllocations: ManualAllocation[];
};

type SinAsignarData = {
  empresas: EmpresaOption[];
  periodos: PeriodoOption[];
  fDesde?: string;
  fHasta?: string;
  noCias?: string[];
  meta?: { asistenciaLabel: string };
  summary?: {
    pendientes: number;
    asignadosManual: number;
    devengadoPendiente: number;
    devengadoAsignado: number;
  };
  pendientes?: EmpleadoRow[];
  asignados?: EmpleadoRow[];
  contracts?: ContractOption[];
};

type AllocationLine = {
  contractId: string;
  devengado: string;
};

function periodKey(p: PeriodoOption) {
  return `${p.ano}|${p.fDesde}|${p.fHasta}`;
}

function contractLabel(c: ContractOption) {
  return `${c.client} · ${c.licitacionNo}`;
}

function MetricCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-xl font-semibold mt-1 ${accent ?? ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

export default function NominaSinAsignarPage() {
  const { data: session } = useSession();
  const canEdit = hasPermission(session ?? null, "empleadosNaf.sinAsignar", "edit");
  const queryClient = useQueryClient();

  const [selectedNoCias, setSelectedNoCias] = useState<string[]>([]);
  const [selectedPeriodKey, setSelectedPeriodKey] = useState("");
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<"pendientes" | "asignados">("pendientes");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EmpleadoRow | null>(null);
  const [lines, setLines] = useState<AllocationLine[]>([{ contractId: "", devengado: "" }]);
  const [notes, setNotes] = useState("");

  const empresasKey = [...selectedNoCias].sort().join(",");

  const { data, isLoading, isFetching, refetch, isError } = useQuery({
    queryKey: ["empleados-naf-sin-asignar", empresasKey, selectedPeriodKey, filter],
    enabled: selectedNoCias.length > 0 && Boolean(selectedPeriodKey),
    queryFn: async () => {
      const [ano, fDesde, fHasta] = selectedPeriodKey.split("|");
      const sp = new URLSearchParams();
      selectedNoCias.forEach((noCia) => sp.append("noCia", noCia));
      sp.set("fDesde", fDesde!);
      sp.set("fHasta", fHasta!);
      if (filter.trim()) sp.set("q", filter.trim());
      const res = await fetch(`/api/empleados-naf/nomina/sin-asignar?${sp.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Error al cargar casos sin asignar");
      }
      return (await res.json()) as { data: SinAsignarData };
    },
  });

  const catalogQuery = useQuery({
    queryKey: ["empleados-naf-sin-asignar-catalog", empresasKey],
    enabled: selectedNoCias.length > 0,
    queryFn: async () => {
      const sp = new URLSearchParams();
      selectedNoCias.forEach((noCia) => sp.append("noCia", noCia));
      const res = await fetch(`/api/empleados-naf/nomina/sin-asignar?${sp.toString()}`);
      if (!res.ok) throw new Error("Error al cargar catálogo");
      return (await res.json()) as { data: SinAsignarData };
    },
  });

  const payload = data?.data;
  const empresas = payload?.empresas ?? catalogQuery.data?.data.empresas ?? [];
  const periodos = payload?.periodos ?? catalogQuery.data?.data.periodos ?? [];
  const contracts = payload?.contracts ?? [];

  useEffect(() => {
    if (empresas.length > 0 && selectedNoCias.length === 0) {
      setSelectedNoCias([empresas[0]!.noCia]);
    }
  }, [empresas, selectedNoCias.length]);

  useEffect(() => {
    if (periodos.length > 0 && !selectedPeriodKey) {
      setSelectedPeriodKey(periodKey(periodos[0]!));
    }
  }, [periodos, selectedPeriodKey]);

  const rows = tab === "pendientes" ? payload?.pendientes ?? [] : payload?.asignados ?? [];

  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.noEmple, row.nombre, row.codPla, row.nominaNombre, row.contratoRrhh, row.companyLabel]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [rows, filter]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editing || !payload?.fDesde || !payload?.fHasta) {
        throw new Error("Datos incompletos");
      }
      const parsedLines = lines
        .filter((line) => line.contractId)
        .map((line) => ({
          contractId: line.contractId,
          devengado: Number(line.devengado.replace(/,/g, "")),
        }));
      const res = await fetch("/api/empleados-naf/nomina/sin-asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noCia: editing.noCia,
          noEmple: editing.noEmple,
          fDesde: payload.fDesde,
          fHasta: payload.fHasta,
          codPla: editing.codPla,
          lines: parsedLines,
          notes,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Error al guardar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Asignación guardada");
      setDialogOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-sin-asignar"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-nomina"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (row: EmpleadoRow) => {
      if (!payload?.fDesde || !payload?.fHasta) throw new Error("Periodo no seleccionado");
      const res = await fetch("/api/empleados-naf/nomina/sin-asignar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          noCia: row.noCia,
          noEmple: row.noEmple,
          fDesde: payload.fDesde,
          fHasta: payload.fHasta,
          codPla: row.codPla,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error ?? "Error al eliminar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Asignación eliminada");
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-sin-asignar"] });
      queryClient.invalidateQueries({ queryKey: ["empleados-naf-nomina"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openAssignDialog(row: EmpleadoRow) {
    setEditing(row);
    if (row.manualAllocations.length > 0) {
      setLines(
        row.manualAllocations.map((alloc) => ({
          contractId: alloc.contractId,
          devengado: String(alloc.devengado),
        })),
      );
    } else {
      setLines([{ contractId: "", devengado: String(row.devengado) }]);
    }
    setNotes("");
    setDialogOpen(true);
  }

  const linesSum = lines.reduce((sum, line) => sum + (Number(line.devengado.replace(/,/g, "")) || 0), 0);
  const editingDevengado = editing?.devengado ?? 0;
  const linesValid = Math.abs(linesSum - editingDevengado) <= 0.02 && lines.every((l) => l.contractId);

  const selectedPeriod = periodos.find((p) => periodKey(p) === selectedPeriodKey);

  return (
    <ModulePage>
      <ModulePageHeader
        title="Nómina sin asignar"
        description="Empleados pagados en la quincena sin registro de asistencia ni contrato imputado. Asigne manualmente el salario a uno o más contratos del sistema."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/empleados-naf/nomina">Ver nómina completa</Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Empresas NAF</p>
            <MultiSelect
              options={empresas.map((e) => ({ value: e.noCia, label: e.companyLabel }))}
              value={selectedNoCias}
              onChange={setSelectedNoCias}
              placeholder="Seleccione empresas"
            />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Quincena</p>
            <Select value={selectedPeriodKey} onValueChange={setSelectedPeriodKey}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccione quincena" />
              </SelectTrigger>
              <SelectContent>
                {periodos.map((p) => (
                  <SelectItem key={periodKey(p)} value={periodKey(p)}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Buscar</p>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Empleado, planilla, contrato RRHH…"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
        </div>

        {selectedPeriod && payload?.fDesde && (
          <p className="text-sm text-muted-foreground">
            Periodo nómina {formatDate(payload.fDesde)} – {formatDate(payload.fHasta)}
            {payload.meta?.asistenciaLabel ? ` · Asistencia ${payload.meta.asistenciaLabel}` : ""}
          </p>
        )}

        {payload?.summary && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label="Pendientes" value={payload.summary.pendientes} accent="text-amber-600" />
            <MetricCard
              label="Devengado pendiente"
              value={formatCurrency(payload.summary.devengadoPendiente)}
              accent="text-amber-600"
            />
            <MetricCard label="Asignados manual" value={payload.summary.asignadosManual} accent="text-emerald-600" />
            <MetricCard
              label="Devengado asignado"
              value={formatCurrency(payload.summary.devengadoAsignado)}
              accent="text-emerald-600"
            />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant={tab === "pendientes" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("pendientes")}
          >
            <UserX className="h-4 w-4 mr-1" />
            Pendientes ({payload?.summary?.pendientes ?? 0})
          </Button>
          <Button
            variant={tab === "asignados" ? "default" : "outline"}
            size="sm"
            onClick={() => setTab("asignados")}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Asignados ({payload?.summary?.asignadosManual ?? 0})
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : isError ? (
          <div className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            Error al cargar los datos
          </div>
        ) : filteredRows.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              {tab === "pendientes"
                ? "No hay empleados pendientes de asignación en esta quincena."
                : "No hay asignaciones manuales en esta quincena."}
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Empleado</th>
                  <th className="px-3 py-2 text-left font-medium">Empresa</th>
                  <th className="px-3 py-2 text-left font-medium">Planilla</th>
                  <th className="px-3 py-2 text-left font-medium">Contrato RRHH</th>
                  <th className="px-3 py-2 text-right font-medium">Devengado</th>
                  <th className="px-3 py-2 text-right font-medium">Neto</th>
                  {tab === "asignados" && (
                    <th className="px-3 py-2 text-left font-medium">Asignado a</th>
                  )}
                  <th className="px-3 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr key={`${row.noCia}|${row.noEmple}|${row.codPla}`} className="border-t">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.nombre ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{row.noEmple}</div>
                    </td>
                    <td className="px-3 py-2">{row.companyLabel}</td>
                    <td className="px-3 py-2">
                      <div>{row.codPla}</div>
                      <div className="text-xs text-muted-foreground">{row.nominaNombre ?? ""}</div>
                    </td>
                    <td className="px-3 py-2">
                      <div>{row.contratoRrhh ?? "—"}</div>
                      {row.licitacionNo && (
                        <div className="text-xs text-muted-foreground">{row.licitacionNo}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.devengado)}</td>
                    <td className="px-3 py-2 text-right">{formatCurrency(row.neto)}</td>
                    {tab === "asignados" && (
                      <td className="px-3 py-2">
                        {row.manualAllocations.map((alloc) => (
                          <div key={alloc.id} className="text-xs">
                            {alloc.contract.client} · {alloc.contract.licitacionNo} (
                            {formatCurrency(alloc.devengado)})
                          </div>
                        ))}
                      </td>
                    )}
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {canEdit ? (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => openAssignDialog(row)}>
                            <Link2 className="h-3.5 w-3.5 mr-1" />
                            {tab === "pendientes" ? "Asignar" : "Editar"}
                          </Button>
                          {tab === "asignados" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600"
                              onClick={() => deleteMutation.mutate(row)}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      ) : (
                        <Badge variant="secondary">Solo lectura</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Asignar salario a contrato</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="rounded-md bg-muted/50 p-3 text-sm">
                <p className="font-medium">{editing.nombre ?? editing.noEmple}</p>
                <p className="text-muted-foreground">
                  {editing.companyLabel} · Planilla {editing.codPla}
                </p>
                <p className="mt-1">
                  Devengado total: <strong>{formatCurrency(editing.devengado)}</strong>
                </p>
              </div>

              {lines.map((line, index) => (
                <div key={index} className="grid grid-cols-[1fr_120px_32px] gap-2 items-end">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Contrato</p>
                    <Select
                      value={line.contractId}
                      onValueChange={(value) =>
                        setLines((prev) =>
                          prev.map((item, i) => (i === index ? { ...item, contractId: value } : item)),
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione contrato" />
                      </SelectTrigger>
                      <SelectContent>
                        {contracts.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {contractLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Devengado</p>
                    <Input
                      value={line.devengado}
                      onChange={(e) =>
                        setLines((prev) =>
                          prev.map((item, i) =>
                            i === index ? { ...item, devengado: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={lines.length <= 1}
                    onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setLines((prev) => [...prev, { contractId: "", devengado: "0" }])}
              >
                <Plus className="h-4 w-4 mr-1" />
                Dividir en otro contrato
              </Button>

              <div className="text-xs text-muted-foreground">
                Suma asignada: {formatCurrency(linesSum)}
                {!linesValid && editingDevengado > 0 && (
                  <span className="text-amber-600 ml-2">
                    Debe coincidir con {formatCurrency(editingDevengado)}
                  </span>
                )}
              </div>

              <Input
                placeholder="Notas (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canEdit || !linesValid || saveMutation.isPending}
            >
              Guardar asignación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ModulePage>
  );
}
