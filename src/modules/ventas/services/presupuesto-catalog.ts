import { prisma } from "@/modules/core/db/prisma";
import { PANI_EXCEL_2026 } from "../business/pani-excel-reference";
import type { CatalogSnapshot } from "../business/presupuesto-calculator";
import { totalGastosAdminMensual } from "./presupuesto-catalog-helpers";

function serializeDecimal(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || null;
}

function serializeJsonDecimals<T>(value: T): T {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => serializeJsonDecimals(v)) as T;
  if (typeof value === "object") {
    if ("toNumber" in value && typeof (value as { toNumber: () => number }).toNumber === "function") {
      return serializeDecimal(value) as T;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serializeJsonDecimals(v);
    }
    return out as T;
  }
  return value;
}

export async function loadPresupuestoCatalog(): Promise<CatalogSnapshot> {
  const [jornadas, insumoVariantes, gastosAdmin] = await Promise.all([
    prisma.ventasJornadaTipo.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { codigo: true, costoMoReferencia: true },
    }),
    prisma.ventasInsumoVariante.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.ventasGastoAdmin.findMany({ where: { isActive: true } }),
  ]);

  const gaFromDb = totalGastosAdminMensual(gastosAdmin);

  return {
    jornadas,
    insumoVariantes,
    gaTotalMensual: gaFromDb > 0 ? gaFromDb : PANI_EXCEL_2026.gaTotalMensual,
  };
}

export async function getCatalogForApi() {
  const [catalog, salarios, jornadasFull, cargasSociales, pagosExtras, insumos, gastosAdmin, indices] =
    await Promise.all([
      loadPresupuestoCatalog(),
      prisma.ventasSalarioCategoria.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.ventasJornadaTipo.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.ventasCargaSocial.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.ventasPagoExtra.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.ventasInsumoItem.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.ventasGastoAdmin.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } }),
      prisma.ventasIndiceActualizacion.findMany({ orderBy: { codigo: "asc" } }),
    ]);

  return serializeJsonDecimals({
    salarios,
    jornadas: jornadasFull,
    cargasSociales,
    pagosExtras,
    insumos,
    insumoVariantes: catalog.insumoVariantes,
    gastosAdmin,
    gaTotalMensual: catalog.gaTotalMensual,
    indices,
    excelReferencia: {
      licitacionNo: PANI_EXCEL_2026.licitacionNo,
      archivo: "CÁLCULO COSTOS 2026 PANI.xlsx",
    },
  });
}
