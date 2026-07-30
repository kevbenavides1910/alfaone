import { prisma } from "@/modules/core/db/prisma";
import {
  buildSapToCompanyMap,
  companySapLabel,
  normalizeSapCode,
  resolveCompanyFromSapCode,
} from "@/modules/empleados/business/company-sap";
import { nafEmployeeSourceKey } from "@/modules/empleados-naf/business/employee-key";
import {
  classifyFormaPagoCanal,
  type FormaPagoCanal,
} from "@/modules/empleados-naf/business/revision-planilla-pago";
import {
  listNafNominaEmpresas,
  listNafNominaPeriodos,
  listNafNominaPlanillas,
  type NafNominaEmpresaOption,
  type NafNominaPeriodoOption,
  type NafNominaPlanillaOption,
} from "@/modules/empleados-naf/services/list-nomina";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import {
  loadRevisionChecklistMap,
  revisionChecklistKey,
} from "@/modules/empleados-naf/services/revision-planilla-checklist";

export type { NafNominaEmpresaOption, NafNominaPeriodoOption, NafNominaPlanillaOption };

export type RevisionPlanillaRow = {
  noCia: string;
  companyCode: string | null;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
  /** Estado NAF de planilla abierta: C=Calculada, M=En proceso, A=Abierta, null=cerrada/histórica. */
  estado: string | null;
  estadoLabel: string | null;
  empleados: number;
  /** Total ingresos / bruto (devengado). */
  ingresos: number;
  deducciones: number;
  /** Ingresos − deducciones (líquido pagable). */
  liquido: number;
  cheque: number;
  davivienda: number;
  bn: number;
  otro: number;
  /** CK + DAV + BN (+ otro). */
  sumaFormasPago: number;
  /** líquido − sumaFormasPago (debe tender a 0). */
  diferencia: number;
  revisada: boolean;
  generada: boolean;
  /** True cuando cada canal con monto > 0 está marcado pagado. */
  pagada: boolean;
  pagadaCk: boolean;
  pagadaDav: boolean;
  pagadaBn: boolean;
};

function planillaPagadaPorBancos(
  cheque: number,
  davivienda: number,
  bn: number,
  flags: { pagadaCk: boolean; pagadaDav: boolean; pagadaBn: boolean },
): boolean {
  const hasAny = cheque > 0 || davivienda > 0 || bn > 0;
  if (!hasAny) return false;
  return (
    (cheque <= 0 || flags.pagadaCk) &&
    (davivienda <= 0 || flags.pagadaDav) &&
    (bn <= 0 || flags.pagadaBn)
  );
}

export type RevisionPlanillaTotales = {
  empleados: number;
  ingresos: number;
  deducciones: number;
  liquido: number;
  cheque: number;
  davivienda: number;
  bn: number;
  otro: number;
  sumaFormasPago: number;
  diferencia: number;
};

export type RevisionPlanillaResult = {
  ano: number;
  fDesde: string;
  fHasta: string;
  noCias: string[];
  porPlanilla: RevisionPlanillaRow[];
  totales: RevisionPlanillaTotales;
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

function calendarDateKey(value: Date | string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function parseDateInput(value: string): Date {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Fecha inválida: ${value}`);
  }
  return date;
}

function normalizeNoCiaList(noCias?: string[]): string[] {
  if (!noCias?.length) return [];
  const normalized = noCias
    .map((raw) => normalizeSapCode(raw.trim()) ?? raw.trim())
    .filter(Boolean);
  return [...new Set(normalized)];
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function estadoLabel(estado: string | null | undefined): string | null {
  const code = (estado ?? "").trim().toUpperCase();
  if (code === "C") return "Calculada";
  if (code === "M") return "En proceso";
  if (code === "A") return "Abierta";
  if (!code) return null;
  return code;
}

/**
 * Referencia de planilla en un rango de fechas.
 * Debe incluir codPla: distintas planillas de la misma cia pueden reutilizar
 * el mismo número de periodo en otros rangos (p.ej. ADMIN periodo 13 en ene
 * vs OFICIALES periodo 13 en jul), y filtrar solo por ano|periodo las mezcla.
 */
type PlanillaPeriodRef = {
  noCia: string;
  codPla: string;
  ano: number;
  periodo: number;
};

async function resolvePlanillaPeriodsByDateRange(
  noCias: string[],
  fDesde: string,
  fHasta: string,
): Promise<PlanillaPeriodRef[]> {
  const desdeKey = calendarDateKey(parseDateInput(fDesde));
  const hastaKey = calendarDateKey(parseDateInput(fHasta));
  if (!desdeKey || !hastaKey) {
    throw new Error("Rango de fechas inválido");
  }

  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: { noCia: { in: noCias } },
    select: {
      noCia: true,
      codPla: true,
      ano: true,
      periodo: true,
      fDesde: true,
      fHasta: true,
    },
  });

  const refs: PlanillaPeriodRef[] = [];
  const seen = new Set<string>();

  for (const row of metaRows) {
    if (!row.fDesde || !row.fHasta) continue;
    if (calendarDateKey(row.fDesde) !== desdeKey || calendarDateKey(row.fHasta) !== hastaKey) {
      continue;
    }
    const key = `${row.noCia}|${row.codPla}|${row.ano}|${row.periodo}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({
      noCia: row.noCia,
      codPla: row.codPla,
      ano: row.ano,
      periodo: row.periodo,
    });
  }

  return refs;
}

async function loadCompanyContext() {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { code: true, name: true, sapCode: true },
  });
  const sapToCompany = buildSapToCompanyMap(companies);
  const companyByCode = new Map(companies.map((c) => [c.code, c]));
  return { sapToCompany, companyByCode };
}

function resolveCompanyLabel(
  noCia: string,
  sapToCompany: Map<string, string>,
  companyByCode: Map<string, { code: string; name: string; sapCode: string | null }>,
): { companyCode: string | null; companyLabel: string } {
  const { sapCode, companyCode } = resolveCompanyFromSapCode(noCia, sapToCompany);
  const company = companyCode ? companyByCode.get(companyCode) : undefined;
  return {
    companyCode,
    companyLabel: companySapLabel(sapCode, companyCode, company?.name ?? null),
  };
}

function emptyTotales(): RevisionPlanillaTotales {
  return {
    empleados: 0,
    ingresos: 0,
    deducciones: 0,
    liquido: 0,
    cheque: 0,
    davivienda: 0,
    bn: 0,
    otro: 0,
    sumaFormasPago: 0,
    diferencia: 0,
  };
}

function addCanal(
  target: { cheque: number; davivienda: number; bn: number; otro: number },
  canal: FormaPagoCanal,
  neto: number,
) {
  // Solo líquido > 0, como el archivo bancario de Codisa / preparar ARPLCK.
  // Un neto ≤ 0 no se paga; si se suma al canal BN/DAV/CK el total no cuadra con Codisa.
  if (neto <= 0) return;
  if (canal === "CK") target.cheque += neto;
  else if (canal === "DAV") target.davivienda += neto;
  else if (canal === "BN") target.bn += neto;
  else target.otro += neto;
}

type PagoInfo = {
  formaPago: string | null;
  banco: string | null;
  idCta: string | null;
};

/**
 * Forma de pago de planilla (RPL3073): ARPLME.FORMA_PAGO + banco VDATOS / ID_CTA.
 * EMPLEADOS_NEW.FORMA_PAGO suele venir vacío y no es la fuente del reporte.
 */
async function loadPagoInfoFromArplme(noCias: string[]): Promise<Map<string, PagoInfo>> {
  const map = new Map<string, PagoInfo>();
  if (noCias.length === 0) return map;

  try {
    const rows = await withNafOracleConnection(async (conn) => {
      const binds: Record<string, string> = {};
      const placeholders = noCias.map((cia, index) => {
        const key = `c${index}`;
        binds[key] = cia;
        return `:${key}`;
      });
      const result = await conn.execute<Record<string, unknown>>(
        `SELECT
           m.NO_CIA,
           m.NO_EMPLE,
           m.FORMA_PAGO,
           m.ID_CTA,
           d.BANCO
         FROM NAF5.ARPLME m
         LEFT JOIN NAF5.VDATOS_EMPLEADO d
           ON d.NO_CIA = m.NO_CIA AND d.NO_EMPLE = m.NO_EMPLE
         WHERE m.NO_CIA IN (${placeholders.join(", ")})`,
        binds,
      );
      return result.rows ?? [];
    });

    for (const row of rows) {
      const noCia = String(row.NO_CIA ?? "").trim();
      const noEmple = String(row.NO_EMPLE ?? "").trim();
      if (!noCia || !noEmple) continue;
      const formaPago = row.FORMA_PAGO != null ? String(row.FORMA_PAGO).trim() || null : null;
      const banco = row.BANCO != null ? String(row.BANCO).trim() || null : null;
      const idCta = row.ID_CTA != null ? String(row.ID_CTA).trim() || null : null;
      map.set(nafEmployeeSourceKey(noCia, noEmple), { formaPago, banco, idCta });
    }
  } catch {
    // Sin Oracle: se usa el maestro local como respaldo.
  }

  return map;
}

export async function getRevisionPlanillaByDateRange(
  fDesde: string,
  fHasta: string,
  noCiasInput: string[],
  filters?: { codPlas?: string[] },
): Promise<RevisionPlanillaResult> {
  const noCias = normalizeNoCiaList(noCiasInput);
  if (noCias.length === 0) {
    throw new Error("Seleccione al menos una empresa");
  }

  const codPlas = filters?.codPlas?.map((value) => value.trim()).filter(Boolean) ?? [];
  const codPlaRefs = codPlas
    .map((value) => {
      const [noCia, codPla] = value.includes("|") ? value.split("|") : [null, value];
      if (!codPla) return null;
      return { noCia: noCia?.trim() || null, codPla: codPla.trim() };
    })
    .filter((value): value is { noCia: string | null; codPla: string } => Boolean(value));
  const codPlaRefSet =
    codPlaRefs.length > 0
      ? new Set(codPlaRefs.map((ref) => `${ref.noCia ?? "*"}|${ref.codPla}`))
      : null;

  const planillaPeriods = await resolvePlanillaPeriodsByDateRange(noCias, fDesde, fHasta);
  const ano = new Date(fDesde).getUTCFullYear();

  if (planillaPeriods.length === 0) {
    return {
      ano,
      fDesde,
      fHasta,
      noCias,
      porPlanilla: [],
      totales: emptyTotales(),
    };
  }

  const { sapToCompany, companyByCode } = await loadCompanyContext();

  const [summaries, metaRows] = await Promise.all([
    prisma.nafNominaSummary.findMany({
      where: {
        OR: planillaPeriods.map((ref) => ({
          noCia: ref.noCia,
          codPla: ref.codPla,
          ano: ref.ano,
          periodo: ref.periodo,
        })),
      },
      select: {
        noCia: true,
        noEmple: true,
        codPla: true,
        nominaNombre: true,
        devengado: true,
        deducciones: true,
        neto: true,
      },
    }),
    prisma.nafNominaPeriodMeta.findMany({
      where: {
        OR: planillaPeriods.map((ref) => ({
          noCia: ref.noCia,
          codPla: ref.codPla,
          ano: ref.ano,
          periodo: ref.periodo,
        })),
      },
      select: { noCia: true, codPla: true, descri: true, tipoEmp: true },
    }),
  ]);

  const filteredSummaries = codPlaRefSet
    ? summaries.filter(
        (summary) =>
          codPlaRefSet.has(`${summary.noCia}|${summary.codPla}`) ||
          codPlaRefSet.has(`*|${summary.codPla}`),
      )
    : summaries;

  const descriByPlanilla = new Map<string, string>();
  const estadoByPlanilla = new Map<string, string>();
  for (const meta of metaRows) {
    const key = `${meta.noCia}|${meta.codPla}`;
    const descri = meta.descri?.trim();
    if (descri && !descriByPlanilla.has(key)) descriByPlanilla.set(key, descri);
    const estado = meta.tipoEmp?.trim().toUpperCase();
    if (estado && ["C", "M", "A"].includes(estado) && !estadoByPlanilla.has(key)) {
      estadoByPlanilla.set(key, estado);
    }
  }

  const employeeKeys = [
    ...new Set(filteredSummaries.map((s) => nafEmployeeSourceKey(s.noCia, s.noEmple))),
  ];
  const companiesInSummaries = [...new Set(filteredSummaries.map((s) => s.noCia))];
  const [employees, pagoByKey, checklistByKey] = await Promise.all([
    employeeKeys.length
      ? prisma.nafEmployee.findMany({
          where: { sourceKey: { in: employeeKeys } },
          select: {
            sourceKey: true,
            formaPago: true,
            banco: true,
            nominaNombre: true,
          },
        })
      : Promise.resolve([]),
    loadPagoInfoFromArplme(companiesInSummaries),
    loadRevisionChecklistMap(noCias, fDesde, fHasta),
  ]);
  const employeeByKey = new Map(employees.map((e) => [e.sourceKey, e]));

  type Agg = {
    noCia: string;
    companyCode: string | null;
    companyLabel: string;
    codPla: string;
    nominaNombre: string | null;
    estado: string | null;
    empleadoIds: Set<string>;
    ingresos: number;
    deducciones: number;
    liquido: number;
    cheque: number;
    davivienda: number;
    bn: number;
    otro: number;
  };

  const agg = new Map<string, Agg>();

  for (const summary of filteredSummaries) {
    const sourceKey = nafEmployeeSourceKey(summary.noCia, summary.noEmple);
    const employee = employeeByKey.get(sourceKey);
    const pago = pagoByKey.get(sourceKey);
    const ingresos = decimalToNumber(summary.devengado);
    const deducciones = decimalToNumber(summary.deducciones);
    const liquido = decimalToNumber(summary.neto);
    const canal = classifyFormaPagoCanal(
      pago?.formaPago ?? employee?.formaPago,
      pago?.banco ?? employee?.banco,
      pago?.idCta,
    );
    const planillaKey = `${summary.noCia}|${summary.codPla}`;

    let current = agg.get(planillaKey);
    if (!current) {
      const { companyCode, companyLabel } = resolveCompanyLabel(
        summary.noCia,
        sapToCompany,
        companyByCode,
      );
      current = {
        noCia: summary.noCia,
        companyCode,
        companyLabel,
        codPla: summary.codPla,
        nominaNombre:
          summary.nominaNombre ??
          employee?.nominaNombre ??
          descriByPlanilla.get(planillaKey) ??
          null,
        estado: estadoByPlanilla.get(planillaKey) ?? null,
        empleadoIds: new Set(),
        ingresos: 0,
        deducciones: 0,
        liquido: 0,
        cheque: 0,
        davivienda: 0,
        bn: 0,
        otro: 0,
      };
      agg.set(planillaKey, current);
    }

    if (!current.nominaNombre) {
      current.nominaNombre =
        summary.nominaNombre ??
        employee?.nominaNombre ??
        descriByPlanilla.get(planillaKey) ??
        null;
    }
    if (!current.estado) {
      current.estado = estadoByPlanilla.get(planillaKey) ?? null;
    }
    current.empleadoIds.add(sourceKey);
    current.ingresos += ingresos;
    current.deducciones += deducciones;
    current.liquido += liquido;
    addCanal(current, canal, liquido);
  }

  const desdeKey = calendarDateKey(parseDateInput(fDesde)) ?? fDesde;
  const hastaKey = calendarDateKey(parseDateInput(fHasta)) ?? fHasta;

  const porPlanilla: RevisionPlanillaRow[] = Array.from(agg.values())
    .map((row) => {
      const sumaFormasPago = roundMoney(row.cheque + row.davivienda + row.bn + row.otro);
      const liquido = roundMoney(row.liquido);
      const flags = checklistByKey.get(
        revisionChecklistKey(row.noCia, row.codPla, desdeKey, hastaKey),
      );
      const cheque = roundMoney(row.cheque);
      const davivienda = roundMoney(row.davivienda);
      const bn = roundMoney(row.bn);
      const bankFlags = {
        pagadaCk: flags?.pagadaCk ?? false,
        pagadaDav: flags?.pagadaDav ?? false,
        pagadaBn: flags?.pagadaBn ?? false,
      };
      return {
        noCia: row.noCia,
        companyCode: row.companyCode,
        companyLabel: row.companyLabel,
        codPla: row.codPla,
        nominaNombre: row.nominaNombre,
        estado: row.estado,
        estadoLabel: estadoLabel(row.estado),
        empleados: row.empleadoIds.size,
        ingresos: roundMoney(row.ingresos),
        deducciones: roundMoney(row.deducciones),
        liquido,
        cheque,
        davivienda,
        bn,
        otro: roundMoney(row.otro),
        sumaFormasPago,
        diferencia: roundMoney(liquido - sumaFormasPago),
        revisada: flags?.revisada ?? false,
        generada: flags?.generada ?? false,
        pagada: planillaPagadaPorBancos(cheque, davivienda, bn, bankFlags),
        ...bankFlags,
      };
    });

  // Incluir planillas del periodo aún sin montos (en proceso), para ir validando conforme llegan.
  for (const meta of metaRows) {
    const key = `${meta.noCia}|${meta.codPla}`;
    if (agg.has(key)) continue;
    if (
      codPlaRefSet &&
      !codPlaRefSet.has(key) &&
      !codPlaRefSet.has(`*|${meta.codPla}`)
    ) {
      continue;
    }
    const { companyCode, companyLabel } = resolveCompanyLabel(
      meta.noCia,
      sapToCompany,
      companyByCode,
    );
    const estado = estadoByPlanilla.get(key) ?? null;
    const flags = checklistByKey.get(
      revisionChecklistKey(meta.noCia, meta.codPla, desdeKey, hastaKey),
    );
    porPlanilla.push({
      noCia: meta.noCia,
      companyCode,
      companyLabel,
      codPla: meta.codPla,
      nominaNombre: meta.descri?.trim() || null,
      estado,
      estadoLabel: estadoLabel(estado),
      empleados: 0,
      ingresos: 0,
      deducciones: 0,
      liquido: 0,
      cheque: 0,
      davivienda: 0,
      bn: 0,
      otro: 0,
      sumaFormasPago: 0,
      diferencia: 0,
      revisada: flags?.revisada ?? false,
      generada: flags?.generada ?? false,
      pagada: false,
      pagadaCk: flags?.pagadaCk ?? false,
      pagadaDav: flags?.pagadaDav ?? false,
      pagadaBn: flags?.pagadaBn ?? false,
    });
  }

  porPlanilla.sort((a, b) => {
      const cia = a.noCia.localeCompare(b.noCia);
      if (cia !== 0) return cia;
      return a.codPla.localeCompare(b.codPla);
    });

  const totales = porPlanilla.reduce<RevisionPlanillaTotales>(
    (acc, row) => ({
      empleados: acc.empleados + row.empleados,
      ingresos: roundMoney(acc.ingresos + row.ingresos),
      deducciones: roundMoney(acc.deducciones + row.deducciones),
      liquido: roundMoney(acc.liquido + row.liquido),
      cheque: roundMoney(acc.cheque + row.cheque),
      davivienda: roundMoney(acc.davivienda + row.davivienda),
      bn: roundMoney(acc.bn + row.bn),
      otro: roundMoney(acc.otro + row.otro),
      sumaFormasPago: roundMoney(acc.sumaFormasPago + row.sumaFormasPago),
      diferencia: roundMoney(acc.diferencia + row.diferencia),
    }),
    emptyTotales(),
  );

  return {
    ano,
    fDesde,
    fHasta,
    noCias,
    porPlanilla,
    totales,
  };
}

export {
  listNafNominaEmpresas as listRevisionPlanillaEmpresas,
  listNafNominaPeriodos as listRevisionPlanillaPeriodos,
  listNafNominaPlanillas as listRevisionPlanillaPlanillas,
};
