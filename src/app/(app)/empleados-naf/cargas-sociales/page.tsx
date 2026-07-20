"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Percent, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSession } from "@/lib/auth/client-session";
import { formatPctPoints } from "@/lib/utils/format";
import { hasPermission } from "@/lib/permissions/check";
import { ModulePage } from "@/components/layout/ModulePage";
import { ModulePageHeader } from "@/components/layout/ModulePageHeader";
import { PresupuestoEditableCell } from "@/components/ventas/PresupuestoEditableField";
import { PresupuestoModuloPanel } from "@/components/ventas/PresupuestoModuloPanel";
import { CatalogDeleteButton } from "@/components/ventas/CatalogLineActions";

type EmpresaOption = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
};

type CargaSocialRow = {
  codigo: string;
  nombre: string;
  porcentaje: number;
  grupo: string;
  sortOrder: number;
};

type CargasResponse = {
  data: {
    empresas: EmpresaOption[];
    cargas?: {
      noCia: string;
      items: CargaSocialRow[];
      totalPct: number;
    };
  };
};

export default function NafCargasSocialesPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canEdit = hasPermission(session ?? null, "empleadosNaf.cargasSociales", "edit");

  const [selectedNoCia, setSelectedNoCia] = useState("");
  const [newNombre, setNewNombre] = useState("");
  const [newPorcentaje, setNewPorcentaje] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["empleados-naf-cargas-sociales", selectedNoCia || "catalog"],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (selectedNoCia) sp.set("noCia", selectedNoCia);
      const res = await fetch(`/api/empleados-naf/cargas-sociales?${sp}`);
      if (!res.ok) throw new Error("Error al cargar cargas sociales");
      return (await res.json()) as CargasResponse;
    },
  });

  const empresas = data?.data.empresas ?? [];
  const cargas = data?.data.cargas;
  const totalPct = cargas?.totalPct ?? 0;

  const selectedEmpresa = useMemo(
    () => empresas.find((e) => e.noCia === selectedNoCia),
    [empresas, selectedNoCia],
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["empleados-naf-cargas-sociales"] });

  const savePct = useMutation({
    mutationFn: async (payload: { codigo: string; porcentaje: number }) => {
      const res = await fetch("/api/empleados-naf/cargas-sociales", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noCia: selectedNoCia, ...payload }),
      });
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: invalidate,
  });

  const addLine = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/empleados-naf/cargas-sociales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          noCia: selectedNoCia,
          item: {
            nombre: newNombre.trim(),
            porcentaje: Number(newPorcentaje),
          },
        }),
      });
      if (!res.ok) throw new Error("Error al agregar línea");
      return res.json();
    },
    onSuccess: () => {
      setNewNombre("");
      setNewPorcentaje("");
      invalidate();
    },
  });

  const deleteLine = useMutation({
    mutationFn: async (codigo: string) => {
      const res = await fetch("/api/empleados-naf/cargas-sociales", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noCia: selectedNoCia, codigo }),
      });
      if (!res.ok) throw new Error("Error al eliminar");
      return res.json();
    },
    onSuccess: invalidate,
  });

  return (
    <ModulePage wide className="space-y-4">
      <ModulePageHeader
        title="Cargas sociales por empresa"
        description="Parametrización de cargas patronales por compañía NAF. El total de % se aplica al devengado en las tablas de nómina."
        icon={Percent}
      />

      <div className="flex flex-col sm:flex-row gap-3 max-w-xl">
        <select
          className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          value={selectedNoCia}
          onChange={(e) => setSelectedNoCia(e.target.value)}
        >
          <option value="">Seleccione una empresa</option>
          {empresas.map((empresa) => (
            <option key={empresa.noCia} value={empresa.noCia}>
              {empresa.companyLabel} ({empresa.noCia})
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Cargando empresas y cargas sociales…</p>
      )}

      {!isLoading && !selectedNoCia && (
        <p className="text-sm text-muted-foreground">
          Seleccione una empresa para ver o editar sus cargas sociales. Al abrirla por primera vez
          se cargan los valores por defecto del módulo de ventas.
        </p>
      )}

      {selectedNoCia && cargas && (
        <PresupuestoModuloPanel
          title={`Cargas sociales — ${selectedEmpresa?.companyLabel ?? selectedNoCia}`}
          description={`El total de ${formatPctPoints(totalPct)} se refleja en el devengado + cargas de la nómina NAF.`}
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-slate-50">
                <th className="px-2 py-1 text-left">Concepto</th>
                <th className="px-2 py-1 text-right">%</th>
                {canEdit && <th className="px-2 py-1 w-10" />}
              </tr>
            </thead>
            <tbody>
              {cargas.items.map((item) => (
                <tr key={item.codigo} className="border-t">
                  <td className="px-2 py-1">{item.nombre}</td>
                  <PresupuestoEditableCell
                    value={item.porcentaje}
                    canEdit={canEdit}
                    onSave={async (value) =>
                      savePct.mutateAsync({
                        codigo: item.codigo,
                        porcentaje: Number(value),
                      })
                    }
                  />
                  {canEdit && (
                    <td className="px-2 py-1">
                      <CatalogDeleteButton
                        canEdit={canEdit}
                        onDelete={async () => deleteLine.mutateAsync(item.codigo)}
                      />
                    </td>
                  )}
                </tr>
              ))}
              <tr className="border-t bg-slate-50 font-medium">
                <td className="px-2 py-2">Total</td>
                <td className="px-2 py-2 text-right tabular-nums">{formatPctPoints(totalPct)}</td>
                {canEdit && <td />}
              </tr>
            </tbody>
          </table>

          {canEdit && (
            <div className="mt-3 flex flex-wrap items-end gap-2 border-t pt-3">
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs text-muted-foreground">Concepto</label>
                <Input
                  value={newNombre}
                  onChange={(e) => setNewNombre(e.target.value)}
                  placeholder="Nueva carga social"
                />
              </div>
              <div className="w-28">
                <label className="text-xs text-muted-foreground">%</label>
                <Input
                  type="number"
                  step="0.01"
                  value={newPorcentaje}
                  onChange={(e) => setNewPorcentaje(e.target.value)}
                  placeholder="0"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={
                  addLine.isPending ||
                  !newNombre.trim() ||
                  !newPorcentaje ||
                  Number.isNaN(Number(newPorcentaje))
                }
                onClick={() => addLine.mutate()}
              >
                <Plus className="h-4 w-4 mr-1" />
                Agregar línea
              </Button>
            </div>
          )}
        </PresupuestoModuloPanel>
      )}
    </ModulePage>
  );
}
