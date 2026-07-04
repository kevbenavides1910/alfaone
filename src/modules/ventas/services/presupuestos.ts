import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import {
  calcularEstructuraResumen,
  calcularLinea,
  type PresupuestoConfig,
} from "../business/presupuesto-calculator";
import type {
  PresupuestoCreateInput,
  PresupuestoLineaInput,
  PresupuestoToleranciaInput,
  PresupuestoUpdateInput,
} from "../validations/presupuesto.schema";
import { getCatalogForApi, loadPresupuestoCatalog } from "./presupuesto-catalog";
import {
  getOrCreatePresupuestoConfig,
  loadCatalogForPresupuesto,
  serializeConfig,
} from "./presupuesto-parametros";
import {
  listModifiedCatalogKeys,
  parametrosModificados,
  parseCatalogOverrides,
} from "../business/catalog-overrides";

function n(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function configFromPresupuesto(p: {
  anioBase: number;
  polizaInsPct: unknown;
  ivaPct: unknown;
  margenUtilidadPct: unknown;
  imprevistosPct: unknown;
}): PresupuestoConfig {
  const dec = (v: unknown) =>
    typeof v === "object" && v !== null && "toNumber" in v
      ? (v as { toNumber: () => number }).toNumber()
      : Number(v);

  return {
    anioBase: p.anioBase,
    polizaInsPct: dec(p.polizaInsPct),
    ivaPct: dec(p.ivaPct),
    margenUtilidadPct: dec(p.margenUtilidadPct),
    imprevistosPct: dec(p.imprevistosPct),
  };
}

export async function recalcularPresupuesto(presupuestoId: string) {
  const presupuesto = await prisma.ventasPresupuesto.findUnique({
    where: { id: presupuestoId },
    include: { lineas: { orderBy: { sortOrder: "asc" } } },
  });
  if (!presupuesto) return null;

  const catalog = await loadCatalogForPresupuesto(presupuestoId);
  const config = configFromPresupuesto(presupuesto);

  const calculos = presupuesto.lineas.map((l) =>
    calcularLinea(
      {
        numeroLinea: l.numeroLinea,
        descripcion: l.descripcion,
        jornadaCodigo: l.jornadaCodigo,
        equipamiento: l.equipamiento,
        cantidadPuestos: l.cantidadPuestos,
        factorOficiales: Number(l.factorOficiales),
        codigoHojaInsumo: l.codigoHojaInsumo,
      },
      {
        jornadas: catalog.jornadas.map((j) => ({
          codigo: j.codigo as never,
          costoMoReferencia: j.costoMoReferencia,
        })),
        insumoVariantes: catalog.insumoVariantes as never,
        gaTotalMensual: catalog.gaTotalMensual,
      },
      config
    )
  );

  await prisma.$transaction(
    presupuesto.lineas.map((l, i) => {
      const c = calculos[i];
      return prisma.ventasPresupuestoLinea.update({
        where: { id: l.id },
        data: {
          costoMo: n(c.costoMo),
          costoGa: n(c.costoGa),
          costoInDirecto: n(c.costoInDirecto),
          costoInIndirecto: n(c.costoInIndirecto),
          imprevistos: n(c.imprevistos),
          margenUtilidad: n(c.margenUtilidad),
          precioMensual: n(c.precioMensual),
          precioAnual: n(c.precioAnual),
          precioConIva: n(c.precioConIva),
          desglose: c.desglose,
        },
      });
    })
  );

  const estructura = calcularEstructuraResumen(calculos, config);

  await prisma.ventasPresupuesto.update({
    where: { id: presupuestoId },
    data: {
      totalMensual: n(estructura.totalMensual),
      totalAnual: n(estructura.totalAnual),
      totalConIva: n(estructura.totalConIva),
      estructuraResumen: estructura,
    },
  });

  return getPresupuestoDetail(presupuestoId);
}

export async function createPresupuesto(input: PresupuestoCreateInput, userId?: string) {
  if (input.oportunidadId) {
    const existing = await prisma.ventasPresupuesto.findUnique({
      where: { oportunidadId: input.oportunidadId },
    });
    if (existing) return { created: false as const, row: existing };
  }

  const defaults = await getOrCreatePresupuestoConfig();
  const cfg = serializeConfig(defaults);

  const row = await prisma.ventasPresupuesto.create({
    data: {
      oportunidadId: input.oportunidadId ?? null,
      licitacionNo: input.licitacionNo.trim(),
      compania: (input.compania ?? cfg.compania).trim(),
      nombre: input.nombre?.trim() || null,
      anioBase: input.anioBase ?? cfg.anioBase,
      polizaInsPct: n(input.polizaInsPct ?? cfg.polizaInsPct),
      ivaPct: n(input.ivaPct ?? cfg.ivaPct),
      margenUtilidadPct: n(input.margenUtilidadPct ?? cfg.margenUtilidadPct),
      imprevistosPct: n(input.imprevistosPct ?? cfg.imprevistosPct),
      createdById: userId ?? null,
    },
  });

  return { created: true as const, row };
}

export async function updatePresupuesto(id: string, input: PresupuestoUpdateInput) {
  const existing = await prisma.ventasPresupuesto.findUnique({ where: { id } });
  if (!existing) return null;

  const row = await prisma.ventasPresupuesto.update({
    where: { id },
    data: {
      licitacionNo: input.licitacionNo?.trim(),
      compania: input.compania?.trim(),
      nombre: input.nombre !== undefined ? input.nombre?.trim() || null : undefined,
      anioBase: input.anioBase,
      polizaInsPct: input.polizaInsPct != null ? n(input.polizaInsPct) : undefined,
      ivaPct: input.ivaPct != null ? n(input.ivaPct) : undefined,
      margenUtilidadPct: input.margenUtilidadPct != null ? n(input.margenUtilidadPct) : undefined,
      imprevistosPct: input.imprevistosPct != null ? n(input.imprevistosPct) : undefined,
      estado: input.estado,
    },
  });

  await recalcularPresupuesto(id);
  return row;
}

export async function addPresupuestoLinea(presupuestoId: string, input: PresupuestoLineaInput) {
  const presupuesto = await prisma.ventasPresupuesto.findUnique({ where: { id: presupuestoId } });
  if (!presupuesto) return null;

  const maxSort = await prisma.ventasPresupuestoLinea.aggregate({
    where: { presupuestoId },
    _max: { sortOrder: true },
  });

  const linea = await prisma.ventasPresupuestoLinea.create({
    data: {
      presupuestoId,
      numeroLinea: input.numeroLinea.trim(),
      descripcion: input.descripcion.trim(),
      jornadaCodigo: input.jornadaCodigo,
      equipamiento: input.equipamiento,
      cantidadPuestos: input.cantidadPuestos,
      factorOficiales: n(input.factorOficiales),
      codigoHojaInsumo: input.codigoHojaInsumo ?? null,
      sortOrder: input.sortOrder ?? (maxSort._max.sortOrder ?? 0) + 1,
    },
  });

  await recalcularPresupuesto(presupuestoId);
  return linea;
}

export async function deletePresupuestoLinea(presupuestoId: string, lineaId: string) {
  const linea = await prisma.ventasPresupuestoLinea.findFirst({
    where: { id: lineaId, presupuestoId },
  });
  if (!linea) return false;

  await prisma.ventasPresupuestoLinea.delete({ where: { id: lineaId } });
  await recalcularPresupuesto(presupuestoId);
  return true;
}

export async function upsertTolerancia(presupuestoId: string, input: PresupuestoToleranciaInput) {
  const presupuesto = await prisma.ventasPresupuesto.findUnique({ where: { id: presupuestoId } });
  if (!presupuesto) return null;

  return prisma.ventasPresupuestoTolerancia.upsert({
    where: { presupuestoId },
    create: {
      presupuestoId,
      ofertaPropia: input.ofertaPropia != null ? n(input.ofertaPropia) : null,
      ofertaCompetencia: input.ofertaCompetencia != null ? n(input.ofertaCompetencia) : null,
      ofertaCliente: input.ofertaCliente != null ? n(input.ofertaCliente) : null,
      observaciones: input.observaciones ?? null,
    },
    update: {
      ofertaPropia: input.ofertaPropia != null ? n(input.ofertaPropia) : null,
      ofertaCompetencia: input.ofertaCompetencia != null ? n(input.ofertaCompetencia) : null,
      ofertaCliente: input.ofertaCliente != null ? n(input.ofertaCliente) : null,
      observaciones: input.observaciones ?? null,
    },
  });
}

function serializeDecimal(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null && "toNumber" in v) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v) || null;
}

export async function getPresupuestoDetail(id: string) {
  const row = await prisma.ventasPresupuesto.findUnique({
    where: { id },
    include: {
      oportunidad: true,
      lineas: { orderBy: { sortOrder: "asc" } },
      tolerancia: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!row) return null;

  const defaultsConfig = await getOrCreatePresupuestoConfig();
  const defaults = serializeConfig(defaultsConfig);
  const catalog = await loadCatalogForPresupuesto(id);
  const overrides = parseCatalogOverrides(row.catalogOverrides);

  const presupuestoSerial = {
    ...row,
    polizaInsPct: serializeDecimal(row.polizaInsPct)!,
    ivaPct: serializeDecimal(row.ivaPct)!,
    margenUtilidadPct: serializeDecimal(row.margenUtilidadPct)!,
    imprevistosPct: serializeDecimal(row.imprevistosPct)!,
    totalMensual: serializeDecimal(row.totalMensual),
    totalAnual: serializeDecimal(row.totalAnual),
    totalConIva: serializeDecimal(row.totalConIva),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };

  return {
    presupuesto: presupuestoSerial,
    defaults,
    parametrosModificados: parametrosModificados(
      {
        compania: presupuestoSerial.compania,
        anioBase: presupuestoSerial.anioBase,
        polizaInsPct: presupuestoSerial.polizaInsPct,
        ivaPct: presupuestoSerial.ivaPct,
        margenUtilidadPct: presupuestoSerial.margenUtilidadPct,
        imprevistosPct: presupuestoSerial.imprevistosPct,
      },
      defaults
    ),
    catalogoModificado: listModifiedCatalogKeys(overrides),
    lineas: row.lineas.map((l) => ({
      ...l,
      factorOficiales: serializeDecimal(l.factorOficiales),
      costoMo: serializeDecimal(l.costoMo),
      costoGa: serializeDecimal(l.costoGa),
      costoInDirecto: serializeDecimal(l.costoInDirecto),
      costoInIndirecto: serializeDecimal(l.costoInIndirecto),
      imprevistos: serializeDecimal(l.imprevistos),
      margenUtilidad: serializeDecimal(l.margenUtilidad),
      precioMensual: serializeDecimal(l.precioMensual),
      precioAnual: serializeDecimal(l.precioAnual),
      precioConIva: serializeDecimal(l.precioConIva),
    })),
    tolerancia: row.tolerancia
      ? {
          ...row.tolerancia,
          ofertaPropia: serializeDecimal(row.tolerancia.ofertaPropia),
          ofertaCompetencia: serializeDecimal(row.tolerancia.ofertaCompetencia),
          ofertaCliente: serializeDecimal(row.tolerancia.ofertaCliente),
        }
      : null,
    catalog,
  };
}
