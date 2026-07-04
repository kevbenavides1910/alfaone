import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import type { CatalogOverrides } from "../business/catalog-overrides";
import {
  buildCatalogOverridesFromEdits,
  gaTotalFromCatalog,
  mergeCatalogForPresupuesto,
  parseCatalogOverrides,
} from "../business/catalog-overrides";
import {
  createGlobalCatalogItem,
  deleteGlobalCatalogItem,
  addPresupuestoCatalogLine,
  removePresupuestoCatalogLine,
} from "./catalog-crud";
import { getCatalogForApi } from "./presupuesto-catalog";
import type { ParametrosGeneralesUpdateInput, CatalogItemUpdateInput } from "../validations/parametros.schema";

function dec(v: unknown): number {
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || 0;
}

function n(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

export async function getOrCreatePresupuestoConfig() {
  const existing = await prisma.ventasPresupuestoConfig.findUnique({ where: { id: "default" } });
  if (existing) return existing;

  return prisma.ventasPresupuestoConfig.create({
    data: { id: "default" },
  });
}

export function serializeConfig(row: {
  compania: string;
  anioBase: number;
  polizaInsPct: unknown;
  ivaPct: unknown;
  margenUtilidadPct: unknown;
  imprevistosPct: unknown;
  updatedAt: Date;
}) {
  return {
    compania: row.compania,
    anioBase: row.anioBase,
    polizaInsPct: dec(row.polizaInsPct),
    ivaPct: dec(row.ivaPct),
    margenUtilidadPct: dec(row.margenUtilidadPct),
    imprevistosPct: dec(row.imprevistosPct),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getParametrosGenerales() {
  const config = await getOrCreatePresupuestoConfig();
  const catalog = await getCatalogForApi();
  return {
    config: serializeConfig(config),
    catalog,
  };
}

export async function updateParametrosGenerales(input: ParametrosGeneralesUpdateInput) {
  const row = await prisma.ventasPresupuestoConfig.update({
    where: { id: "default" },
    data: {
      compania: input.compania?.trim(),
      anioBase: input.anioBase,
      polizaInsPct: input.polizaInsPct != null ? n(input.polizaInsPct) : undefined,
      ivaPct: input.ivaPct != null ? n(input.ivaPct) : undefined,
      margenUtilidadPct: input.margenUtilidadPct != null ? n(input.margenUtilidadPct) : undefined,
      imprevistosPct: input.imprevistosPct != null ? n(input.imprevistosPct) : undefined,
    },
  });
  return serializeConfig(row);
}

export async function updateCatalogItemGlobal(input: CatalogItemUpdateInput) {
  const { section, codigo, field, value } = input;

  switch (section) {
    case "salarios": {
      const row = await prisma.ventasSalarioCategoria.findUnique({ where: { codigo } });
      if (!row) return null;
      if (field === "valoresPorAnio" && typeof value === "object" && value !== null) {
        const merged = { ...(row.valoresPorAnio as Record<string, number>), ...value };
        await prisma.ventasSalarioCategoria.update({ where: { codigo }, data: { valoresPorAnio: merged } });
      }
      break;
    }
    case "jornadas": {
      const data: Prisma.VentasJornadaTipoUpdateInput = {};
      if (field === "salarioBaseMensual") data.salarioBaseMensual = n(value as number);
      if (field === "costoHoraOrdinaria") data.costoHoraOrdinaria = n(value as number);
      if (field === "costoMoReferencia") data.costoMoReferencia = n(value as number);
      await prisma.ventasJornadaTipo.update({ where: { codigo: codigo as never }, data });
      break;
    }
    case "cargasSociales":
      await prisma.ventasCargaSocial.update({
        where: { codigo },
        data: { porcentaje: n(value as number) },
      });
      break;
    case "pagosExtras":
      await prisma.ventasPagoExtra.update({
        where: { codigo },
        data: { valor: n(value as number) },
      });
      break;
    case "insumos":
      await prisma.ventasInsumoItem.update({
        where: { codigo },
        data: { costoUnitario: n(value as number) },
      });
      break;
    case "gastosAdmin":
      await prisma.ventasGastoAdmin.update({
        where: { codigo },
        data: { montoMensual: n(value as number) },
      });
      break;
    case "indices":
      await prisma.ventasIndiceActualizacion.update({
        where: { codigo },
        data: { valor: n(value as number) },
      });
      break;
    default:
      return null;
  }

  return getParametrosGenerales();
}

export async function updatePresupuestoCatalogOverride(
  presupuestoId: string,
  input: CatalogItemUpdateInput
) {
  const presupuesto = await prisma.ventasPresupuesto.findUnique({ where: { id: presupuestoId } });
  if (!presupuesto) return null;

  const globalCatalog = await getCatalogForApi();
  let current = parseCatalogOverrides(presupuesto.catalogOverrides);
  const { section, codigo, field, value } = input;

  if (section === "salarios" && field === "valoresPorAnio" && typeof value === "object" && value !== null) {
    const globalRow = globalCatalog.salarios.find((x) => x.codigo === codigo);
    const globalYears = (globalRow?.valoresPorAnio ?? {}) as Record<string, number>;
    const patchYears = value as Record<string, number>;
    const prev = current.salarios?.[codigo]?.valoresPorAnio ?? {};
    const merged = { ...prev, ...patchYears };

    const differs = Object.entries(merged).some(
      ([year, val]) => Math.abs(val - (globalYears[year] ?? 0)) >= 0.0001
    );

    const salarios = { ...(current.salarios ?? {}) };
    if (!differs) {
      delete salarios[codigo];
    } else {
      salarios[codigo] = { valoresPorAnio: merged };
    }
    current = { ...current, salarios: Object.keys(salarios).length ? salarios : undefined };
  } else {
    let globalValue: number | Record<string, number> = 0;
    if (section === "jornadas") {
      const j = globalCatalog.jornadas.find((x) => x.codigo === codigo);
      globalValue = dec((j as Record<string, unknown>)?.[field]);
    } else if (section === "cargasSociales") {
      globalValue = dec(globalCatalog.cargasSociales.find((x) => x.codigo === codigo)?.porcentaje);
    } else if (section === "pagosExtras") {
      globalValue = dec(globalCatalog.pagosExtras.find((x) => x.codigo === codigo)?.valor);
    } else if (section === "insumos") {
      globalValue = dec(globalCatalog.insumos.find((x) => x.codigo === codigo)?.costoUnitario);
    } else if (section === "gastosAdmin") {
      globalValue = dec(globalCatalog.gastosAdmin.find((x) => x.codigo === codigo)?.montoMensual);
    } else if (section === "indices") {
      globalValue = dec(globalCatalog.indices.find((x) => x.codigo === codigo)?.valor);
    }

    current = buildCatalogOverridesFromEdits(
      current,
      section,
      codigo,
      field,
      value as number | Record<string, number> | null,
      globalValue
    );
  }

  await prisma.ventasPresupuesto.update({
    where: { id: presupuestoId },
    data: { catalogOverrides: current as Prisma.InputJsonValue },
  });

  return current;
}

export async function loadCatalogForPresupuesto(presupuestoId?: string | null) {
  const global = await getCatalogForApi();
  if (!presupuestoId) return global;

  const presupuesto = await prisma.ventasPresupuesto.findUnique({
    where: { id: presupuestoId },
    select: { catalogOverrides: true },
  });
  if (!presupuesto) return global;

  const overrides = parseCatalogOverrides(presupuesto.catalogOverrides);
  const merged = mergeCatalogForPresupuesto(
    global as Parameters<typeof mergeCatalogForPresupuesto>[0],
    overrides
  );
  return {
    ...merged,
    gaTotalMensual: gaTotalFromCatalog(merged.gastosAdmin) || global.gaTotalMensual,
  };
}

export {
  createGlobalCatalogItem,
  deleteGlobalCatalogItem,
  addPresupuestoCatalogLine,
  removePresupuestoCatalogLine,
} from "./catalog-crud";
