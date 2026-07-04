import { readFileSync, existsSync } from "fs";
import path from "path";
import {
  Prisma,
  type PrismaClient,
  type VentasEquipamiento,
  type VentasJornadaCodigo,
} from "@prisma/client";
import * as XLSX from "xlsx";
import {
  PANI_DEFAULT_FILE,
  PANI_HOJA_INSUMO_MAP,
  PANI_HORARIO_TO_JORNADA,
  PANI_INSUMO_SHEET_NAMES,
  parseInsumoHojaFromFormula,
  parseJornadaFromMoFormula,
} from "../business/pani-excel-mappings";
import { normalizeLicitacionNo } from "./normalize-licitacion";
import { recalcularPresupuesto } from "./presupuestos";

export type PaniImportOptions = {
  /** Sincronizar catálogo (MO E46, variantes insumo C127, GA) desde el Excel. */
  syncCatalog?: boolean;
  /** Si ya existe presupuesto para la licitación, reemplazar líneas y parámetros. */
  replaceExisting?: boolean;
  userId?: string;
};

export type PaniImportStats = {
  presupuestoId: string;
  licitacionNo: string;
  lineasImportadas: number;
  catalogVariantes: number;
  catalogJornadas: number;
  oportunidadVinculada: boolean;
  reemplazado: boolean;
  toleranciaTotalPropia: number | null;
  toleranciaTotalCompetencia: number | null;
};

type ParsedLinea = {
  numeroLinea: string;
  descripcion: string;
  jornadaCodigo: VentasJornadaCodigo;
  equipamiento: VentasEquipamiento;
  cantidadPuestos: number;
  factorOficiales: number;
  codigoHojaInsumo: string | null;
  sortOrder: number;
};

function n(v: number): Prisma.Decimal {
  return new Prisma.Decimal(v);
}

function cellNum(v: unknown): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const s = String(v).replace(/,/g, ".").trim();
  const parsed = parseFloat(s);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function cellStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

function formatNumeroLinea(v: unknown): string {
  const s = cellStr(v);
  if (!s) return "";
  if (/^\d+$/.test(s)) return s;
  return s;
}

function isDetalleDataRow(lin: unknown, desc: string, horario: unknown): boolean {
  if (!lin) return false;
  const linStr = String(lin).toUpperCase();
  const descStr = desc.toUpperCase();
  if (linStr.includes("TOTAL") || linStr.includes("PARTIDA")) return false;
  if (descStr.includes("TOTAL") || descStr.includes("PARTIDA")) return false;
  if (horario === "HORARIO") return false;
  return true;
}

function readWorkbook(filePath: string) {
  const buf = readFileSync(filePath);
  return XLSX.read(buf, { type: "buffer", cellFormula: true, cellDates: true });
}

function parseResumen(wb: XLSX.WorkBook) {
  const sheet = wb.Sheets.RESUMEN;
  if (!sheet) throw new Error("Hoja RESUMEN no encontrada");

  const licitacionNo = cellStr(sheet.B10?.v ?? sheet["B10"]?.w);
  const compania = cellStr(sheet.B6?.v ?? sheet["B6"]?.w) || "SEGURIDAD TANGO S.A";
  const polizaRaw = cellNum(sheet.D6?.v);
  const ivaRaw = cellNum(sheet.D7?.v);

  const polizaInsPct = polizaRaw > 0 && polizaRaw < 1 ? polizaRaw * 100 : polizaRaw || 5.75;
  const ivaPct = ivaRaw > 0 && ivaRaw < 1 ? ivaRaw * 100 : ivaRaw || 13;

  const detalle = wb.Sheets.DETALLE;
  const margenRaw = cellNum(detalle?.AD4?.v);
  const margenUtilidadPct =
    margenRaw > 0 && margenRaw < 1 ? margenRaw * 100 : margenRaw || 7.523687797366793;

  if (!licitacionNo) throw new Error("Número de licitación no encontrado en RESUMEN!B10");

  return {
    licitacionNo: normalizeLicitacionNo(licitacionNo),
    compania,
    nombre: cellStr(sheet.B16?.v ?? sheet["B16"]?.w).slice(0, 500) || null,
    anioBase: 2026,
    polizaInsPct,
    ivaPct,
    margenUtilidadPct,
    imprevistosPct: 0.01,
  };
}

function parseDetalleLineas(wb: XLSX.WorkBook): ParsedLinea[] {
  const ws = wb.Sheets.DETALLE;
  if (!ws) throw new Error("Hoja DETALLE no encontrada");

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  const lineas: ParsedLinea[] = [];
  let sortOrder = 0;

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const desc = cellStr(r[2]);
    const horario = r[3];
    const lin = r[1];
    if (!isDetalleDataRow(lin, desc, horario)) continue;

    const rowNum = i + 1;
    const moFormula = ws[`H${rowNum}`]?.f as string | undefined;
    const insumoFormula = ws[`L${rowNum}`]?.f as string | undefined;

    let jornadaCodigo =
      parseJornadaFromMoFormula(moFormula) ??
      PANI_HORARIO_TO_JORNADA[cellStr(horario)] ??
      null;
    if (!jornadaCodigo) {
      throw new Error(`Jornada no reconocida en línea ${formatNumeroLinea(lin)}: ${cellStr(horario)}`);
    }

    const codigoHojaInsumo = parseInsumoHojaFromFormula(insumoFormula);
    const hojaMap = codigoHojaInsumo ? PANI_HOJA_INSUMO_MAP[codigoHojaInsumo] : null;

    const factorOficiales = cellNum(r[6]) || hojaMap?.factorOficiales || 1;
    const equipamiento = hojaMap?.equipamiento ?? "AF";

    const puestos = Math.max(1, Math.round(cellNum(r[5]) || 1));

    sortOrder += 1;
    lineas.push({
      numeroLinea: formatNumeroLinea(lin),
      descripcion: desc.slice(0, 500),
      jornadaCodigo,
      equipamiento,
      cantidadPuestos: puestos,
      factorOficiales,
      codigoHojaInsumo,
      sortOrder,
    });
  }

  if (lineas.length === 0) throw new Error("No se encontraron líneas en DETALLE");
  return lineas;
}

function parseToleranciaTotales(wb: XLSX.WorkBook) {
  const ws = wb.Sheets.TOLERANCIA;
  if (!ws) return { ofertaPropia: null, ofertaCompetencia: null };

  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "" });
  for (let i = rows.length - 1; i >= 0; i--) {
    const r = rows[i];
    if (!r) continue;
    if (String(r[1]).toUpperCase().includes("TOTAL")) {
      const propia = cellNum(r[3]);
      const competencia = cellNum(r[4]);
      return {
        ofertaPropia: propia > 0 ? propia : null,
        ofertaCompetencia: competencia > 0 ? competencia : null,
      };
    }
  }
  return { ofertaPropia: null, ofertaCompetencia: null };
}

async function syncCatalogFromWorkbook(wb: XLSX.WorkBook, prisma: PrismaClient) {
  let variantes = 0;
  let jornadas = 0;

  for (const codigoHoja of PANI_INSUMO_SHEET_NAMES) {
    const sheet = wb.Sheets[codigoHoja];
    if (!sheet) continue;
    const monto = cellNum(sheet.C127?.v);
    if (monto <= 0) continue;

    const map = PANI_HOJA_INSUMO_MAP[codigoHoja];
    await prisma.ventasInsumoVariante.upsert({
      where: { codigoHoja },
      create: {
        codigoHoja,
        equipamiento: map.equipamiento,
        factorOficiales: n(map.factorOficiales),
        montoMensual: n(monto),
        descripcion: `Importado desde Excel PANI (${codigoHoja})`,
      },
      update: {
        equipamiento: map.equipamiento,
        factorOficiales: n(map.factorOficiales),
        montoMensual: n(monto),
        isActive: true,
      },
    });
    variantes += 1;
  }

  const moRefs: { codigo: VentasJornadaCodigo; cell: string }[] = [
    { codigo: "MO1", cell: "E46" },
    { codigo: "MO2", cell: "E46" },
    { codigo: "MO3", cell: "E46" },
    { codigo: "MO4", cell: "E46" },
    { codigo: "MO5", cell: "E46" },
  ];

  for (const { codigo, cell } of moRefs) {
    const sheet = wb.Sheets[codigo];
    if (!sheet) continue;
    const ref = cellNum(sheet[cell]?.v);
    if (ref <= 0) continue;
    await prisma.ventasJornadaTipo.updateMany({
      where: { codigo },
      data: { costoMoReferencia: n(ref) },
    });
    jornadas += 1;
  }

  const gaMonto = cellNum(wb.Sheets.GA?.C12?.v);
  if (gaMonto > 0) {
    await prisma.ventasGastoAdmin.upsert({
      where: { codigo: "GA_TOTAL" },
      create: {
        codigo: "GA_TOTAL",
        nombre: "Gastos administrativos (total mensual)",
        montoMensual: n(gaMonto),
      },
      update: { montoMensual: n(gaMonto), isActive: true },
    });
  }

  return { variantes, jornadas };
}

async function findOportunidadId(prisma: PrismaClient, licitacionNo: string) {
  const op = await prisma.ventasOportunidad.findFirst({
    where: { licitacionNo },
    select: { id: true },
  });
  if (op) return op.id;

  const all = await prisma.ventasOportunidad.findMany({
    select: { id: true, licitacionNo: true },
  });
  const normalized = normalizeLicitacionNo(licitacionNo);
  const match = all.find((o) => normalizeLicitacionNo(o.licitacionNo) === normalized);
  return match?.id ?? null;
}

export function resolvePaniExcelPath(customPath?: string): string {
  if (customPath) {
    const abs = path.isAbsolute(customPath) ? customPath : path.join(process.cwd(), customPath);
    if (!existsSync(abs)) throw new Error(`Archivo no encontrado: ${abs}`);
    return abs;
  }
  const defaultPath = path.join(process.cwd(), "cargas", PANI_DEFAULT_FILE);
  if (!existsSync(defaultPath)) {
    throw new Error(
      `Archivo PANI no encontrado en cargas/${PANI_DEFAULT_FILE}. Suba el Excel o indique ruta.`
    );
  }
  return defaultPath;
}

export async function importPresupuestoFromPaniExcel(
  prisma: PrismaClient,
  filePath: string,
  options: PaniImportOptions = {}
): Promise<PaniImportStats> {
  const { syncCatalog = true, replaceExisting = true, userId } = options;
  const wb = readWorkbook(filePath);
  const config = parseResumen(wb);
  const lineas = parseDetalleLineas(wb);
  const tolerancia = parseToleranciaTotales(wb);

  let catalogVariantes = 0;
  let catalogJornadas = 0;
  if (syncCatalog) {
    const cat = await syncCatalogFromWorkbook(wb, prisma);
    catalogVariantes = cat.variantes;
    catalogJornadas = cat.jornadas;
  }

  const oportunidadId = await findOportunidadId(prisma, config.licitacionNo);

  let existing = await prisma.ventasPresupuesto.findFirst({
    where: {
      OR: [
        ...(oportunidadId ? [{ oportunidadId }] : []),
        { licitacionNo: config.licitacionNo },
      ],
    },
  });

  let presupuestoId: string;
  let reemplazado = false;

  if (existing) {
    if (!replaceExisting) {
      throw new Error(
        `Ya existe presupuesto para ${config.licitacionNo}. Use replaceExisting=true para reemplazar.`
      );
    }
    reemplazado = true;
    await prisma.ventasPresupuestoLinea.deleteMany({ where: { presupuestoId: existing.id } });
    await prisma.ventasPresupuesto.update({
      where: { id: existing.id },
      data: {
        oportunidadId: oportunidadId ?? existing.oportunidadId,
        licitacionNo: config.licitacionNo,
        compania: config.compania,
        nombre: config.nombre,
        anioBase: config.anioBase,
        polizaInsPct: n(config.polizaInsPct),
        ivaPct: n(config.ivaPct),
        margenUtilidadPct: n(config.margenUtilidadPct),
        imprevistosPct: n(config.imprevistosPct),
        estado: "EN_REVISION",
      },
    });
    presupuestoId = existing.id;
  } else {
    const created = await prisma.ventasPresupuesto.create({
      data: {
        oportunidadId,
        licitacionNo: config.licitacionNo,
        compania: config.compania,
        nombre: config.nombre,
        anioBase: config.anioBase,
        polizaInsPct: n(config.polizaInsPct),
        ivaPct: n(config.ivaPct),
        margenUtilidadPct: n(config.margenUtilidadPct),
        imprevistosPct: n(config.imprevistosPct),
        estado: "EN_REVISION",
        createdById: userId ?? null,
      },
    });
    presupuestoId = created.id;
  }

  await prisma.ventasPresupuestoLinea.createMany({
    data: lineas.map((l) => ({
      presupuestoId,
      numeroLinea: l.numeroLinea,
      descripcion: l.descripcion,
      jornadaCodigo: l.jornadaCodigo,
      equipamiento: l.equipamiento,
      cantidadPuestos: l.cantidadPuestos,
      factorOficiales: n(l.factorOficiales),
      codigoHojaInsumo: l.codigoHojaInsumo,
      sortOrder: l.sortOrder,
    })),
  });

  if (tolerancia.ofertaPropia != null || tolerancia.ofertaCompetencia != null) {
    await prisma.ventasPresupuestoTolerancia.upsert({
      where: { presupuestoId },
      create: {
        presupuestoId,
        ofertaPropia: tolerancia.ofertaPropia != null ? n(tolerancia.ofertaPropia) : null,
        ofertaCompetencia:
          tolerancia.ofertaCompetencia != null ? n(tolerancia.ofertaCompetencia) : null,
        observaciones: "Importado desde hoja TOLERANCIA del Excel PANI",
      },
      update: {
        ofertaPropia: tolerancia.ofertaPropia != null ? n(tolerancia.ofertaPropia) : null,
        ofertaCompetencia:
          tolerancia.ofertaCompetencia != null ? n(tolerancia.ofertaCompetencia) : null,
        observaciones: "Importado desde hoja TOLERANCIA del Excel PANI",
      },
    });
  }

  await recalcularPresupuesto(presupuestoId);

  return {
    presupuestoId,
    licitacionNo: config.licitacionNo,
    lineasImportadas: lineas.length,
    catalogVariantes,
    catalogJornadas,
    oportunidadVinculada: oportunidadId != null,
    reemplazado,
    toleranciaTotalPropia: tolerancia.ofertaPropia,
    toleranciaTotalCompetencia: tolerancia.ofertaCompetencia,
  };
}
