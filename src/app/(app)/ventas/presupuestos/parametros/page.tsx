"use client";

import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { hasPermission } from "@/lib/permissions/check";
import { PresupuestoEditableField, PresupuestoEditableCell } from "@/components/ventas/PresupuestoEditableField";
import { PresupuestoModuloPanel } from "@/components/ventas/PresupuestoModuloPanel";
import {
  CatalogAddRow,
  CatalogDeleteButton,
  CATALOG_ADD_FIELDS,
  CATALOG_ALLOW_ADD,
} from "@/components/ventas/CatalogLineActions";
import { useGlobalCatalogMutations } from "@/components/ventas/useCatalogMutations";
import { VENTAS_JORNADA_LABELS } from "@/modules/ventas/client";
import type { CatalogSection } from "@/modules/ventas";

type ParametrosResponse = {
  data: {
    config: {
      compania: string;
      anioBase: number;
      polizaInsPct: number;
      ivaPct: number;
      margenUtilidadPct: number;
      imprevistosPct: number;
    };
    catalog: {
      salarios: Array<{ codigo: string; descripcion: string; valoresPorAnio: Record<string, number> }>;
      jornadas: Array<{ codigo: string; nombre: string; salarioBaseMensual: unknown; costoMoReferencia: unknown }>;
      cargasSociales: Array<{ codigo: string; nombre: string; porcentaje: unknown; grupo: string }>;
      pagosExtras: Array<{ codigo: string; nombre: string; tipo: string; valor: unknown }>;
      insumos: Array<{ codigo: string; nombre: string; categoria: string; costoUnitario: unknown; equipamientos?: string[] }>;
      gastosAdmin: Array<{ codigo: string; nombre: string; montoMensual: unknown }>;
    };
  };
};

function dec(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) return (v as { toNumber: () => number }).toNumber();
  return Number(v) || 0;
}

export default function PresupuestoParametrosPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canEdit = hasPermission(session, "ventas.presupuestos", "edit");

  const { data, isLoading } = useQuery({
    queryKey: ["ventas-presupuesto-parametros"],
    queryFn: async () => {
      const res = await fetch("/api/ventas/presupuestos/parametros", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Error al cargar");
      return (await res.json()) as ParametrosResponse;
    },
  });

  const saveConfig = useMutation({
    mutationFn: async (body: Record<string, string | number>) => {
      const res = await fetch("/api/ventas/presupuestos/parametros", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ventas-presupuesto-parametros"] }),
  });

  const saveCatalog = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch("/api/ventas/presupuestos/parametros", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar catálogo");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ventas-presupuesto-parametros"] }),
  });

  const { addLine, deleteLine } = useGlobalCatalogMutations();

  function sectionFooter(section: CatalogSection) {
    const fields = CATALOG_ADD_FIELDS[section];
    if (!fields) return null;
    return (
      <CatalogAddRow
        section={section}
        fields={fields}
        canEdit={canEdit}
        allowAdd={CATALOG_ALLOW_ADD[section]}
        onAdd={async (item) => addLine.mutateAsync({ section, item })}
      />
    );
  }

  if (isLoading || !data) {
    return <div className="p-6 text-muted-foreground">Cargando parametrización…</div>;
  }

  const { config, catalog } = data.data;

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/ventas/presupuestos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-2">
            <ArrowLeft className="h-4 w-4" /> Presupuestos
          </Link>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-violet-600" />
            <h1 className="text-xl font-semibold">Parametrización general</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Valores por defecto para presupuestos nuevos. Cada presupuesto puede modificarlos; los cambios se marcan en amarillo.
          </p>
        </div>
      </div>

      <PresupuestoModuloPanel title="Configuración RESUMEN (por defecto)" description="Compañía, año base, póliza, IVA, margen e imprevistos.">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <PresupuestoEditableField
            label="Compañía"
            value={config.compania}
            canEdit={canEdit}
            onSave={async (v) => saveConfig.mutateAsync({ compania: String(v) })}
          />
          <PresupuestoEditableField
            label="Año base salarios"
            value={config.anioBase}
            type="number"
            canEdit={canEdit}
            onSave={async (v) => saveConfig.mutateAsync({ anioBase: Number(v) })}
          />
          <PresupuestoEditableField
            label="Póliza INS (%)"
            value={config.polizaInsPct}
            type="number"
            step="0.01"
            canEdit={canEdit}
            onSave={async (v) => saveConfig.mutateAsync({ polizaInsPct: Number(v) })}
          />
          <PresupuestoEditableField
            label="IVA (%)"
            value={config.ivaPct}
            type="number"
            step="0.01"
            canEdit={canEdit}
            onSave={async (v) => saveConfig.mutateAsync({ ivaPct: Number(v) })}
          />
          <PresupuestoEditableField
            label="Margen utilidad (%)"
            value={config.margenUtilidadPct}
            type="number"
            step="0.0001"
            canEdit={canEdit}
            onSave={async (v) => saveConfig.mutateAsync({ margenUtilidadPct: Number(v) })}
          />
          <PresupuestoEditableField
            label="Imprevistos (%)"
            value={config.imprevistosPct}
            type="number"
            step="0.0001"
            canEdit={canEdit}
            onSave={async (v) => saveConfig.mutateAsync({ imprevistosPct: Number(v) })}
          />
        </div>
      </PresupuestoModuloPanel>

      <PresupuestoModuloPanel title="Salarios base" description="Catálogo SALARIOS — clic en celda para editar. Agregar o eliminar líneas afecta presupuestos nuevos.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-2 py-1 text-left">Código</th>
              <th className="px-2 py-1 text-left">Descripción</th>
              <th className="px-2 py-1 text-right">{config.anioBase}</th>
              {canEdit && <th className="px-2 py-1 w-10" />}
            </tr>
          </thead>
          <tbody>
            {catalog.salarios.map((s) => (
              <tr key={s.codigo} className="border-t">
                <td className="px-2 py-1 font-mono text-xs">{s.codigo}</td>
                <td className="px-2 py-1">{s.descripcion}</td>
                <PresupuestoEditableCell
                  value={s.valoresPorAnio[String(config.anioBase)] ?? 0}
                  canEdit={canEdit}
                  onSave={async (v) =>
                    saveCatalog.mutateAsync({
                      section: "salarios",
                      codigo: s.codigo,
                      field: "valoresPorAnio",
                      value: { [String(config.anioBase)]: v },
                    })
                  }
                />
                {canEdit && (
                  <td className="px-2 py-1">
                    <CatalogDeleteButton
                      canEdit={canEdit}
                      onDelete={async () => deleteLine.mutateAsync({ section: "salarios", codigo: s.codigo })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sectionFooter("salarios")}
      </PresupuestoModuloPanel>

      <PresupuestoModuloPanel title="Mano de obra" description="Esquemas de jornada (MO). Clic para editar; agregar o eliminar líneas afecta presupuestos nuevos.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-2 py-1">Código</th>
              <th className="px-2 py-1 text-left">Jornada</th>
              <th className="px-2 py-1 text-right">Salario base</th>
              <th className="px-2 py-1 text-right">Costo MO ref.</th>
              {canEdit && <th className="px-2 py-1 w-10" />}
            </tr>
          </thead>
          <tbody>
            {catalog.jornadas.map((j) => (
              <tr key={j.codigo} className="border-t">
                <td className="px-2 py-1 font-mono">{j.codigo}</td>
                <td className="px-2 py-1">{VENTAS_JORNADA_LABELS[j.codigo] ?? j.nombre}</td>
                <PresupuestoEditableCell
                  value={dec(j.salarioBaseMensual)}
                  canEdit={canEdit}
                  onSave={async (v) =>
                    saveCatalog.mutateAsync({ section: "jornadas", codigo: j.codigo, field: "salarioBaseMensual", value: v })
                  }
                />
                <PresupuestoEditableCell
                  value={dec(j.costoMoReferencia)}
                  canEdit={canEdit}
                  onSave={async (v) =>
                    saveCatalog.mutateAsync({ section: "jornadas", codigo: j.codigo, field: "costoMoReferencia", value: v })
                  }
                />
                {canEdit && (
                  <td className="px-2 py-1">
                    <CatalogDeleteButton
                      canEdit={canEdit}
                      onDelete={async () => deleteLine.mutateAsync({ section: "jornadas", codigo: j.codigo })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sectionFooter("jornadas")}
      </PresupuestoModuloPanel>

      <PresupuestoModuloPanel title="Cargas sociales" description="El total de % se refleja en la estructura de costos.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-2 py-1 text-left">Concepto</th>
              <th className="px-2 py-1 text-right">%</th>
              {canEdit && <th className="px-2 py-1 w-10" />}
            </tr>
          </thead>
          <tbody>
            {catalog.cargasSociales.map((c) => (
              <tr key={c.codigo} className="border-t">
                <td className="px-2 py-1">{c.nombre}</td>
                <PresupuestoEditableCell
                  value={dec(c.porcentaje)}
                  canEdit={canEdit}
                  onSave={async (v) =>
                    saveCatalog.mutateAsync({ section: "cargasSociales", codigo: c.codigo, field: "porcentaje", value: v })
                  }
                />
                {canEdit && (
                  <td className="px-2 py-1">
                    <CatalogDeleteButton
                      canEdit={canEdit}
                      onDelete={async () => deleteLine.mutateAsync({ section: "cargasSociales", codigo: c.codigo })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sectionFooter("cargasSociales")}
      </PresupuestoModuloPanel>

      <PresupuestoModuloPanel title="Pagos extras" description="Vacaciones, feriados, cubre comidas y descanso nocturno.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-2 py-1 text-left">Concepto</th>
              <th className="px-2 py-1">Tipo</th>
              <th className="px-2 py-1 text-right">Valor</th>
              {canEdit && <th className="px-2 py-1 w-10" />}
            </tr>
          </thead>
          <tbody>
            {catalog.pagosExtras.map((p) => (
              <tr key={p.codigo} className="border-t">
                <td className="px-2 py-1">{p.nombre}</td>
                <td className="px-2 py-1 text-xs">{p.tipo}</td>
                <PresupuestoEditableCell
                  value={dec(p.valor)}
                  canEdit={canEdit}
                  onSave={async (v) =>
                    saveCatalog.mutateAsync({ section: "pagosExtras", codigo: p.codigo, field: "valor", value: v })
                  }
                />
                {canEdit && (
                  <td className="px-2 py-1">
                    <CatalogDeleteButton
                      canEdit={canEdit}
                      onDelete={async () => deleteLine.mutateAsync({ section: "pagosExtras", codigo: p.codigo })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sectionFooter("pagosExtras")}
      </PresupuestoModuloPanel>

      <PresupuestoModuloPanel title="Insumos operativos" description="Uniforme, táctico, comunicaciones y armamento.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-2 py-1 text-left">Ítem</th>
              <th className="px-2 py-1">Categoría</th>
              <th className="px-2 py-1">Equip.</th>
              <th className="px-2 py-1 text-right">Costo unitario</th>
              {canEdit && <th className="px-2 py-1 w-10" />}
            </tr>
          </thead>
          <tbody>
            {catalog.insumos.map((i) => (
              <tr key={i.codigo} className="border-t">
                <td className="px-2 py-1">{i.nombre}</td>
                <td className="px-2 py-1 text-xs">{i.categoria}</td>
                <td className="px-2 py-1 text-xs">{(i.equipamientos ?? []).join(", ")}</td>
                <PresupuestoEditableCell
                  value={dec(i.costoUnitario)}
                  canEdit={canEdit}
                  onSave={async (v) =>
                    saveCatalog.mutateAsync({ section: "insumos", codigo: i.codigo, field: "costoUnitario", value: v })
                  }
                />
                {canEdit && (
                  <td className="px-2 py-1">
                    <CatalogDeleteButton
                      canEdit={canEdit}
                      onDelete={async () => deleteLine.mutateAsync({ section: "insumos", codigo: i.codigo })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sectionFooter("insumos")}
      </PresupuestoModuloPanel>

      <PresupuestoModuloPanel title="Gastos administrativos (GA)" description="La suma mensual alimenta el GA por puesto en el cálculo de líneas.">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-slate-50">
              <th className="px-2 py-1 text-left">Concepto</th>
              <th className="px-2 py-1 text-right">Monto/mes</th>
              {canEdit && <th className="px-2 py-1 w-10" />}
            </tr>
          </thead>
          <tbody>
            {catalog.gastosAdmin.map((g) => (
              <tr key={g.codigo} className="border-t">
                <td className="px-2 py-1">{g.nombre}</td>
                <PresupuestoEditableCell
                  value={dec(g.montoMensual)}
                  canEdit={canEdit}
                  onSave={async (v) =>
                    saveCatalog.mutateAsync({ section: "gastosAdmin", codigo: g.codigo, field: "montoMensual", value: v })
                  }
                />
                {canEdit && (
                  <td className="px-2 py-1">
                    <CatalogDeleteButton
                      canEdit={canEdit}
                      onDelete={async () => deleteLine.mutateAsync({ section: "gastosAdmin", codigo: g.codigo })}
                    />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {sectionFooter("gastosAdmin")}
      </PresupuestoModuloPanel>
    </div>
  );
}
