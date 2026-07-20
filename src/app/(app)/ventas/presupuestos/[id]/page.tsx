"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Layers, Plus, Settings2, Trash2 } from "lucide-react";
import { useSession } from "@/lib/auth/client-session";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/permissions/check";
import { formatCurrency } from "@/lib/utils/format";
import {
  VENTAS_EQUIPAMIENTO_LABELS,
  VENTAS_JORNADA_CODIGOS,
  VENTAS_EQUIPAMIENTOS,
  VENTAS_JORNADA_LABELS,
  VENTAS_PRESUPUESTO_ESTADO_LABELS,
} from "@/modules/ventas/client";
import { PresupuestoModuloPanel } from "@/components/ventas/PresupuestoModuloPanel";
import { PresupuestoEditableField, PresupuestoEditableCell } from "@/components/ventas/PresupuestoEditableField";
import {
  CatalogAddRow,
  CatalogDeleteButton,
  catalogRowFlags,
  CATALOG_ADD_FIELDS,
  CATALOG_ALLOW_ADD,
} from "@/components/ventas/CatalogLineActions";
import { usePresupuestoCatalogMutations } from "@/components/ventas/useCatalogMutations";
import type { CatalogSection } from "@/modules/ventas";

type PageProps = { params: Promise<{ id: string }> };

type DetailResponse = {
  data: {
    presupuesto: {
      id: string;
      licitacionNo: string;
      compania: string;
      nombre: string | null;
      anioBase: number;
      polizaInsPct: number;
      ivaPct: number;
      margenUtilidadPct: number;
      imprevistosPct: number;
      estado: string;
      totalMensual: number | null;
      totalAnual: number | null;
      totalConIva: number | null;
      estructuraResumen: {
        componentes?: Record<string, { monto: number; pct: number }>;
      } | null;
      oportunidad: { enlace: string | null; cliente: string; descripcion: string } | null;
    };
    lineas: Array<{
      id: string;
      numeroLinea: string;
      descripcion: string;
      jornadaCodigo: string;
      equipamiento: string;
      cantidadPuestos: number;
      factorOficiales: number;
      precioMensual: number | null;
      precioConIva: number | null;
      costoMo: number | null;
      costoGa: number | null;
      costoInDirecto: number | null;
    }>;
    tolerancia: {
      ofertaPropia: number | null;
      ofertaCompetencia: number | null;
      ofertaCliente: number | null;
      observaciones: string | null;
    } | null;
    catalog: {
      salarios: Array<{ codigo: string; descripcion: string; valoresPorAnio: Record<string, number> }>;
      jornadas: Array<{ codigo: string; nombre: string; salarioBaseMensual: unknown; costoHoraOrdinaria: unknown; costoMoReferencia?: unknown }>;
      cargasSociales: Array<{ codigo: string; nombre: string; porcentaje: unknown; grupo: string }>;
      pagosExtras: Array<{ codigo: string; nombre: string; tipo: string; valor: unknown }>;
      insumos: Array<{ codigo: string; nombre: string; categoria: string; costoUnitario: unknown; equipamientos: string[] }>;
      gastosAdmin: Array<{ codigo: string; nombre: string; montoMensual: unknown }>;
      indices: Array<{ codigo: string; nombre: string }>;
    };
    defaults: {
      compania: string;
      anioBase: number;
      polizaInsPct: number;
      ivaPct: number;
      margenUtilidadPct: number;
      imprevistosPct: number;
    };
    parametrosModificados: Partial<Record<string, boolean>>;
    catalogoModificado: Record<
      CatalogSection,
      { modificados: string[]; agregados: string[]; excluidos: string[] }
    >;
  };
};

const MODULOS = [
  { id: "resumen", label: "Resumen", icon: "📋" },
  { id: "salarios", label: "Salarios", icon: "💰" },
  { id: "manoObra", label: "Mano de obra", icon: "👷" },
  { id: "cargas", label: "Cargas sociales", icon: "🏛️" },
  { id: "extras", label: "Pagos extras", icon: "➕" },
  { id: "insumos", label: "Insumos", icon: "🎒" },
  { id: "ga", label: "Gastos admin.", icon: "🏢" },
  { id: "estructura", label: "Estructura", icon: "📊" },
  { id: "detalle", label: "Detalle líneas", icon: "📝" },
  { id: "tolerancia", label: "Tolerancia", icon: "⚖️" },
] as const;

function dec(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) return (v as { toNumber: () => number }).toNumber();
  return Number(v) || 0;
}

export default function PresupuestoDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const canEdit = hasPermission(session, "ventas.presupuestos", "edit");
  const [modulo, setModulo] = useState<(typeof MODULOS)[number]["id"]>("resumen");
  const [lineForm, setLineForm] = useState({
    numeroLinea: "",
    descripcion: "",
    jornadaCodigo: "MO1",
    equipamiento: "SA",
    cantidadPuestos: 1,
    factorOficiales: 1,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["ventas-presupuesto", id],
    queryFn: async () => {
      const res = await fetch(`/api/ventas/presupuestos/${id}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("No encontrado");
      return (await res.json()) as DetailResponse;
    },
  });

  const addLinea = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/ventas/presupuestos/${id}/lineas`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(lineForm),
      });
      if (!res.ok) throw new Error("Error al agregar línea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ventas-presupuesto", id] });
      setLineForm((f) => ({ ...f, numeroLinea: "", descripcion: "" }));
    },
  });

  const deleteLinea = useMutation({
    mutationFn: async (lineaId: string) => {
      const res = await fetch(`/api/ventas/presupuestos/${id}/lineas/${lineaId}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Error al eliminar");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ventas-presupuesto", id] }),
  });

  const updatePresupuesto = useMutation({
    mutationFn: async (body: Record<string, string | number>) => {
      const res = await fetch(`/api/ventas/presupuestos/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ventas-presupuesto", id] }),
  });

  const updateCatalogOverride = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/ventas/presupuestos/${id}/catalogo`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error al guardar catálogo");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ventas-presupuesto", id] }),
  });

  const { addLine: addCatalogLine, deleteLine: deleteCatalogLine } = usePresupuestoCatalogMutations(id);

  function sectionFooter(section: CatalogSection) {
    const fields = CATALOG_ADD_FIELDS[section];
    if (!fields) return null;
    return (
      <CatalogAddRow
        section={section}
        fields={fields}
        canEdit={canEdit}
        allowAdd={CATALOG_ALLOW_ADD[section]}
        onAdd={async (item) => addCatalogLine.mutateAsync({ section, item })}
      />
    );
  }

  if (isLoading || !data) {
    return <div className="p-6 text-muted-foreground">Cargando presupuesto…</div>;
  }

  const { presupuesto, lineas, tolerancia, catalog, parametrosModificados, catalogoModificado } = data.data;
  const estructura = presupuesto.estructuraResumen?.componentes ?? {};
  const modCat =
    catalogoModificado ??
    ({
      salarios: { modificados: [], agregados: [], excluidos: [] },
      jornadas: { modificados: [], agregados: [], excluidos: [] },
      cargasSociales: { modificados: [], agregados: [], excluidos: [] },
      pagosExtras: { modificados: [], agregados: [], excluidos: [] },
      insumos: { modificados: [], agregados: [], excluidos: [] },
      gastosAdmin: { modificados: [], agregados: [], excluidos: [] },
      indices: { modificados: [], agregados: [], excluidos: [] },
    } satisfies Record<CatalogSection, { modificados: string[]; agregados: string[]; excluidos: string[] }>);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/ventas/presupuestos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Presupuestos
        </Link>
        <Badge variant="outline">{VENTAS_PRESUPUESTO_ESTADO_LABELS[presupuesto.estado] ?? presupuesto.estado}</Badge>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-violet-600" />
            {presupuesto.licitacionNo}
          </h1>
          <p className="text-sm text-muted-foreground">{presupuesto.compania}</p>
          {presupuesto.oportunidad && (
            <p className="text-sm mt-1">{presupuesto.oportunidad.cliente} — {presupuesto.oportunidad.descripcion}</p>
          )}
        </div>
        <div className="text-right space-y-1">
          <Link href="/ventas/presupuestos/parametros" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
            <Settings2 className="h-3 w-3" /> Parametrización general
          </Link>
          <p className="text-2xl font-semibold">{presupuesto.totalMensual != null ? formatCurrency(presupuesto.totalMensual) : "—"}</p>
          <p className="text-xs text-muted-foreground">mensual · IVA {presupuesto.ivaPct}% → {presupuesto.totalConIva != null ? formatCurrency(presupuesto.totalConIva) : "—"}</p>
          <p className="text-xs text-muted-foreground">anual: {presupuesto.totalAnual != null ? formatCurrency(presupuesto.totalAnual) : "—"}</p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b pb-2">
        {MODULOS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModulo(m.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              modulo === m.id ? "bg-primary text-primary-foreground" : "bg-muted/60 hover:bg-muted"
            }`}
          >
            {m.icon} {m.label}
          </button>
        ))}
      </nav>

      {modulo === "resumen" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Configuración general (RESUMEN)</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div><span className="text-muted-foreground text-xs">Licitación</span><p className="font-medium">{presupuesto.licitacionNo}</p></div>
            <PresupuestoEditableField
              label="Compañía"
              value={presupuesto.compania}
              modified={parametrosModificados?.compania}
              canEdit={canEdit}
              onSave={async (v) => updatePresupuesto.mutateAsync({ compania: String(v) })}
            />
            <PresupuestoEditableField
              label="Año base salarios"
              value={presupuesto.anioBase}
              modified={parametrosModificados?.anioBase}
              type="number"
              canEdit={canEdit}
              onSave={async (v) => updatePresupuesto.mutateAsync({ anioBase: Number(v) })}
            />
            <PresupuestoEditableField
              label="Póliza INS (%)"
              value={presupuesto.polizaInsPct}
              modified={parametrosModificados?.polizaInsPct}
              type="number"
              step="0.01"
              canEdit={canEdit}
              onSave={async (v) => updatePresupuesto.mutateAsync({ polizaInsPct: Number(v) })}
            />
            <PresupuestoEditableField
              label="IVA (%)"
              value={presupuesto.ivaPct}
              modified={parametrosModificados?.ivaPct}
              type="number"
              step="0.01"
              canEdit={canEdit}
              onSave={async (v) => updatePresupuesto.mutateAsync({ ivaPct: Number(v) })}
            />
            <PresupuestoEditableField
              label="Margen utilidad (MU %)"
              value={presupuesto.margenUtilidadPct}
              modified={parametrosModificados?.margenUtilidadPct}
              type="number"
              step="0.0001"
              canEdit={canEdit}
              onSave={async (v) => updatePresupuesto.mutateAsync({ margenUtilidadPct: Number(v) })}
            />
            <PresupuestoEditableField
              label="Imprevistos (I %)"
              value={presupuesto.imprevistosPct}
              modified={parametrosModificados?.imprevistosPct}
              type="number"
              step="0.0001"
              canEdit={canEdit}
              onSave={async (v) => updatePresupuesto.mutateAsync({ imprevistosPct: Number(v) })}
            />
            <div><span className="text-muted-foreground text-xs">Líneas de detalle</span><p className="font-medium">{lineas.length}</p></div>
          </CardContent>
        </Card>
      )}

      {modulo === "salarios" && (
        <PresupuestoModuloPanel title="Salarios base (SALARIOS)" description="Categorías TONC, TOSC, TOC, TOE, TES. Amarillo = distinto a parametrización general; verde = línea agregada aquí. Agregar o eliminar recalcula el presupuesto.">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50"><th className="px-2 py-1 text-left">Código</th><th className="px-2 py-1 text-left">Descripción</th><th className="px-2 py-1 text-right">{presupuesto.anioBase}</th>{canEdit && <th className="px-2 py-1 w-10" />}</tr></thead>
            <tbody>
              {(catalog.salarios ?? []).map((s) => {
                const flags = catalogRowFlags("salarios", s.codigo, modCat);
                return (
                <tr key={s.codigo} className="border-t">
                  <td className="px-2 py-1 font-mono">{s.codigo}</td>
                  <td className="px-2 py-1">{s.descripcion}</td>
                  <PresupuestoEditableCell
                    value={s.valoresPorAnio[String(presupuesto.anioBase)] ?? 0}
                    modified={flags.modified}
                    added={flags.added}
                    canEdit={canEdit}
                    onSave={async (v) =>
                      updateCatalogOverride.mutateAsync({
                        section: "salarios",
                        codigo: s.codigo,
                        field: "valoresPorAnio",
                        value: { [String(presupuesto.anioBase)]: v },
                      })
                    }
                  />
                  {canEdit && (
                    <td className="px-2 py-1">
                      <CatalogDeleteButton
                        canEdit={canEdit}
                        onDelete={async () => deleteCatalogLine.mutateAsync({ section: "salarios", codigo: s.codigo })}
                      />
                    </td>
                  )}
                </tr>
              );})}
            </tbody>
          </table>
          {sectionFooter("salarios")}
        </PresupuestoModuloPanel>
      )}

      {modulo === "manoObra" && (
        <PresupuestoModuloPanel title="Mano de obra" description="Esquemas de jornada. Amarillo = distinto a parametrización; verde = agregado en este presupuesto. Agregar o eliminar recalcula el presupuesto.">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50"><th className="px-2 py-1">Código</th><th className="px-2 py-1 text-left">Jornada</th><th className="px-2 py-1 text-right">Salario base</th><th className="px-2 py-1 text-right">Costo MO ref.</th>{canEdit && <th className="px-2 py-1 w-10" />}</tr></thead>
            <tbody>
              {(catalog.jornadas ?? []).map((j) => {
                const flags = catalogRowFlags("jornadas", j.codigo, modCat);
                return (
                <tr key={j.codigo} className="border-t">
                  <td className="px-2 py-1 font-mono">{j.codigo}</td>
                  <td className="px-2 py-1">{VENTAS_JORNADA_LABELS[j.codigo] ?? j.nombre}</td>
                  <PresupuestoEditableCell
                    value={dec(j.salarioBaseMensual)}
                    modified={flags.modified}
                    added={flags.added}
                    canEdit={canEdit}
                    onSave={async (v) =>
                      updateCatalogOverride.mutateAsync({ section: "jornadas", codigo: j.codigo, field: "salarioBaseMensual", value: v })
                    }
                  />
                  <PresupuestoEditableCell
                    value={dec(j.costoMoReferencia)}
                    modified={flags.modified}
                    added={flags.added}
                    canEdit={canEdit}
                    onSave={async (v) =>
                      updateCatalogOverride.mutateAsync({ section: "jornadas", codigo: j.codigo, field: "costoMoReferencia", value: v })
                    }
                  />
                  {canEdit && (
                    <td className="px-2 py-1">
                      <CatalogDeleteButton
                        canEdit={canEdit}
                        onDelete={async () => deleteCatalogLine.mutateAsync({ section: "jornadas", codigo: j.codigo })}
                      />
                    </td>
                  )}
                </tr>
              );})}
            </tbody>
          </table>
          {sectionFooter("jornadas")}
        </PresupuestoModuloPanel>
      )}

      {modulo === "cargas" && (
        <PresupuestoModuloPanel title="Cargas sociales" description={`Total ${(catalog.cargasSociales ?? []).reduce((s, c) => s + dec(c.porcentaje), 0).toFixed(2)}%. Agregar o eliminar líneas recalcula el presupuesto.`}>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50"><th className="px-2 py-1 text-left">Concepto</th><th className="px-2 py-1">Grupo</th><th className="px-2 py-1 text-right">%</th>{canEdit && <th className="px-2 py-1 w-10" />}</tr></thead>
            <tbody>
              {(catalog.cargasSociales ?? []).map((c) => {
                const flags = catalogRowFlags("cargasSociales", c.codigo, modCat);
                return (
                <tr key={c.codigo} className="border-t">
                  <td className="px-2 py-1">{c.nombre}</td>
                  <td className="px-2 py-1 text-center text-xs text-muted-foreground">{c.grupo}</td>
                  <PresupuestoEditableCell
                    value={dec(c.porcentaje)}
                    modified={flags.modified}
                    added={flags.added}
                    canEdit={canEdit}
                    onSave={async (v) =>
                      updateCatalogOverride.mutateAsync({ section: "cargasSociales", codigo: c.codigo, field: "porcentaje", value: v })
                    }
                  />
                  {canEdit && (
                    <td className="px-2 py-1">
                      <CatalogDeleteButton
                        canEdit={canEdit}
                        onDelete={async () => deleteCatalogLine.mutateAsync({ section: "cargasSociales", codigo: c.codigo })}
                      />
                    </td>
                  )}
                </tr>
              );})}
            </tbody>
          </table>
          {sectionFooter("cargasSociales")}
        </PresupuestoModuloPanel>
      )}

      {modulo === "extras" && (
        <PresupuestoModuloPanel title="Pagos extras" description="Vacaciones, feriados, cubre comidas y descanso nocturno. Agregar o eliminar recalcula el presupuesto.">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50"><th className="px-2 py-1 text-left">Concepto</th><th className="px-2 py-1">Tipo</th><th className="px-2 py-1 text-right">Valor</th>{canEdit && <th className="px-2 py-1 w-10" />}</tr></thead>
            <tbody>
              {(catalog.pagosExtras ?? []).map((p) => {
                const flags = catalogRowFlags("pagosExtras", p.codigo, modCat);
                return (
                <tr key={p.codigo} className="border-t">
                  <td className="px-2 py-1">{p.nombre}</td>
                  <td className="px-2 py-1 text-xs">{p.tipo}</td>
                  <PresupuestoEditableCell
                    value={dec(p.valor)}
                    modified={flags.modified}
                    added={flags.added}
                    canEdit={canEdit}
                    onSave={async (v) =>
                      updateCatalogOverride.mutateAsync({ section: "pagosExtras", codigo: p.codigo, field: "valor", value: v })
                    }
                  />
                  {canEdit && (
                    <td className="px-2 py-1">
                      <CatalogDeleteButton
                        canEdit={canEdit}
                        onDelete={async () => deleteCatalogLine.mutateAsync({ section: "pagosExtras", codigo: p.codigo })}
                      />
                    </td>
                  )}
                </tr>
              );})}
            </tbody>
          </table>
          {sectionFooter("pagosExtras")}
        </PresupuestoModuloPanel>
      )}

      {modulo === "insumos" && (
        <PresupuestoModuloPanel title="Insumos operativos" description="Uniforme, táctico, comunicaciones y armamento. Agregar o eliminar recalcula el presupuesto.">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50"><th className="px-2 py-1 text-left">Ítem</th><th className="px-2 py-1">Categoría</th><th className="px-2 py-1">Equip.</th><th className="px-2 py-1 text-right">Costo</th>{canEdit && <th className="px-2 py-1 w-10" />}</tr></thead>
            <tbody>
              {(catalog.insumos ?? []).map((i) => {
                const flags = catalogRowFlags("insumos", i.codigo, modCat);
                return (
                <tr key={i.codigo} className="border-t">
                  <td className="px-2 py-1">{i.nombre}</td>
                  <td className="px-2 py-1 text-xs">{i.categoria}</td>
                  <td className="px-2 py-1 text-xs">{(i.equipamientos ?? []).join(", ")}</td>
                  <PresupuestoEditableCell
                    value={dec(i.costoUnitario)}
                    modified={flags.modified}
                    added={flags.added}
                    canEdit={canEdit}
                    onSave={async (v) =>
                      updateCatalogOverride.mutateAsync({ section: "insumos", codigo: i.codigo, field: "costoUnitario", value: v })
                    }
                  />
                  {canEdit && (
                    <td className="px-2 py-1">
                      <CatalogDeleteButton
                        canEdit={canEdit}
                        onDelete={async () => deleteCatalogLine.mutateAsync({ section: "insumos", codigo: i.codigo })}
                      />
                    </td>
                  )}
                </tr>
              );})}
            </tbody>
          </table>
          {sectionFooter("insumos")}
        </PresupuestoModuloPanel>
      )}

      {modulo === "ga" && (
        <PresupuestoModuloPanel title="Gastos administrativos (GA)" description={`Total mensual: ${formatCurrency((catalog.gastosAdmin ?? []).reduce((s, g) => s + dec(g.montoMensual), 0))}. Agregar o eliminar recalcula el presupuesto.`}>
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-slate-50"><th className="px-2 py-1 text-left">Concepto</th><th className="px-2 py-1 text-right">Monto/mes</th>{canEdit && <th className="px-2 py-1 w-10" />}</tr></thead>
            <tbody>
              {(catalog.gastosAdmin ?? []).map((g) => {
                const flags = catalogRowFlags("gastosAdmin", g.codigo, modCat);
                return (
                <tr key={g.codigo} className="border-t">
                  <td className="px-2 py-1">{g.nombre}</td>
                  <PresupuestoEditableCell
                    value={dec(g.montoMensual)}
                    modified={flags.modified}
                    added={flags.added}
                    canEdit={canEdit}
                    onSave={async (v) =>
                      updateCatalogOverride.mutateAsync({ section: "gastosAdmin", codigo: g.codigo, field: "montoMensual", value: v })
                    }
                  />
                  {canEdit && (
                    <td className="px-2 py-1">
                      <CatalogDeleteButton
                        canEdit={canEdit}
                        onDelete={async () => deleteCatalogLine.mutateAsync({ section: "gastosAdmin", codigo: g.codigo })}
                      />
                    </td>
                  )}
                </tr>
              );})}
            </tbody>
          </table>
          {sectionFooter("gastosAdmin")}
        </PresupuestoModuloPanel>
      )}

      {modulo === "estructura" && (
        <PresupuestoModuloPanel title="Estructura de costos (ESTRUCTURAS)" description="CDmo, CDi, CImo, GA, I y MU — índices MTSS, IPPI, IPC.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            {Object.entries(estructura).map(([key, val]) => (
              <div key={key} className="rounded-lg border p-3">
                <p className="text-xs text-muted-foreground">{key}</p>
                <p className="font-semibold">{formatCurrency(val.monto)}</p>
                <p className="text-xs">{val.pct.toFixed(2)}% del total</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-2">Índices de actualización</p>
          <ul className="text-sm space-y-1">
            {(catalog.indices ?? []).map((idx) => (
              <li key={idx.codigo}>• {idx.nombre} ({idx.codigo})</li>
            ))}
          </ul>
        </PresupuestoModuloPanel>
      )}

      {modulo === "detalle" && (
        <div className="space-y-4">
          {canEdit && (
            <Card>
              <CardHeader><CardTitle className="text-base">Agregar línea</CardTitle></CardHeader>
              <CardContent className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input placeholder="Nº línea (1.1)" value={lineForm.numeroLinea} onChange={(e) => setLineForm((f) => ({ ...f, numeroLinea: e.target.value }))} />
                <Input placeholder="Descripción del puesto" value={lineForm.descripcion} onChange={(e) => setLineForm((f) => ({ ...f, descripcion: e.target.value }))} className="sm:col-span-2" />
                <select className="h-9 border rounded-md px-2 text-sm" value={lineForm.jornadaCodigo} onChange={(e) => setLineForm((f) => ({ ...f, jornadaCodigo: e.target.value }))}>
                  {(catalog.jornadas ?? []).length === 0 && VENTAS_JORNADA_CODIGOS.map((c) => (
                    <option key={c} value={c}>{VENTAS_JORNADA_LABELS[c]}</option>
                  ))}
                  {(catalog.jornadas ?? []).map((j) => (
                    <option key={j.codigo} value={j.codigo}>
                      {VENTAS_JORNADA_LABELS[j.codigo] ?? j.nombre ?? j.codigo}
                    </option>
                  ))}
                </select>
                <select className="h-9 border rounded-md px-2 text-sm" value={lineForm.equipamiento} onChange={(e) => setLineForm((f) => ({ ...f, equipamiento: e.target.value }))}>
                  {VENTAS_EQUIPAMIENTOS.map((c) => <option key={c} value={c}>{VENTAS_EQUIPAMIENTO_LABELS[c]}</option>)}
                </select>
                <Input type="number" min={1} placeholder="Puestos" value={lineForm.cantidadPuestos} onChange={(e) => setLineForm((f) => ({ ...f, cantidadPuestos: Number(e.target.value) }))} />
                <Input type="number" step="0.01" placeholder="Factor oficiales" value={lineForm.factorOficiales} onChange={(e) => setLineForm((f) => ({ ...f, factorOficiales: Number(e.target.value) }))} />
                <Button size="sm" disabled={addLinea.isPending || !lineForm.numeroLinea || !lineForm.descripcion} onClick={() => addLinea.mutate()}>
                  <Plus className="h-4 w-4 mr-1" /> Agregar
                </Button>
              </CardContent>
            </Card>
          )}
          <PresupuestoModuloPanel title="Detalle de líneas (DETALLE)" description="Cada línea se calcula en el sistema (MO + GA + insumos + imprevistos + margen). Los totales se actualizan al agregar o quitar líneas.">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-2 py-1">Línea</th>
                  <th className="px-2 py-1 text-left">Descripción</th>
                  <th className="px-2 py-1">Jornada</th>
                  <th className="px-2 py-1">Eq.</th>
                  <th className="px-2 py-1 text-center">Puestos</th>
                  <th className="px-2 py-1 text-right">MO</th>
                  <th className="px-2 py-1 text-right">GA</th>
                  <th className="px-2 py-1 text-right">IN-D</th>
                  <th className="px-2 py-1 text-right">Mensual</th>
                  <th className="px-2 py-1 text-right">c/IVA</th>
                  {canEdit && <th className="px-2 py-1" />}
                </tr>
              </thead>
              <tbody>
                {lineas.length === 0 && (
                  <tr><td colSpan={11} className="px-4 py-8 text-center text-muted-foreground">Sin líneas. Agregue puestos para calcular el presupuesto.</td></tr>
                )}
                {lineas.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-2 py-1 font-mono">{l.numeroLinea}</td>
                    <td className="px-2 py-1">{l.descripcion}</td>
                    <td className="px-2 py-1 text-xs">{l.jornadaCodigo}</td>
                    <td className="px-2 py-1 text-xs">{l.equipamiento}</td>
                    <td className="px-2 py-1 text-center">{l.cantidadPuestos}×{l.factorOficiales}</td>
                    <td className="px-2 py-1 text-right">{l.costoMo != null ? formatCurrency(l.costoMo) : "—"}</td>
                    <td className="px-2 py-1 text-right">{l.costoGa != null ? formatCurrency(l.costoGa) : "—"}</td>
                    <td className="px-2 py-1 text-right">{l.costoInDirecto != null ? formatCurrency(l.costoInDirecto) : "—"}</td>
                    <td className="px-2 py-1 text-right font-medium">{l.precioMensual != null ? formatCurrency(l.precioMensual) : "—"}</td>
                    <td className="px-2 py-1 text-right">{l.precioConIva != null ? formatCurrency(l.precioConIva) : "—"}</td>
                    {canEdit && (
                      <td className="px-2 py-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => deleteLinea.mutate(l.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </PresupuestoModuloPanel>
        </div>
      )}

      {modulo === "tolerancia" && (
        <PresupuestoModuloPanel title="Tolerancia" description="Comparativo oferta propia vs competencia y expectativa del cliente.">
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Oferta propia</p>
              <p className="font-semibold text-lg">{tolerancia?.ofertaPropia != null ? formatCurrency(tolerancia.ofertaPropia) : formatCurrency(presupuesto.totalMensual ?? 0)}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Competencia</p>
              <p className="font-semibold text-lg">{tolerancia?.ofertaCompetencia != null ? formatCurrency(tolerancia.ofertaCompetencia) : "—"}</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Cliente</p>
              <p className="font-semibold text-lg">{tolerancia?.ofertaCliente != null ? formatCurrency(tolerancia.ofertaCliente) : "—"}</p>
            </div>
          </div>
          {tolerancia?.observaciones && <p className="mt-3 text-sm text-muted-foreground">{tolerancia.observaciones}</p>}
        </PresupuestoModuloPanel>
      )}
    </div>
  );
}
