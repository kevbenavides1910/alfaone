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
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

export type RevisionPlanillaCanalPago = Extract<FormaPagoCanal, "CK" | "DAV" | "BN" | "OTRO">;

export type RevisionPlanillaEmpleadoPago = {
  noEmple: string;
  nombre: string | null;
  cedula: string | null;
  formaPago: string | null;
  banco: string | null;
  numCuenta: string | null;
  idCta: string | null;
  liquido: number;
};

export type RevisionPlanillaEmpleadosPagoResult = {
  noCia: string;
  companyLabel: string;
  codPla: string;
  nominaNombre: string | null;
  fDesde: string;
  fHasta: string;
  canal: RevisionPlanillaCanalPago;
  canalLabel: string;
  empleados: RevisionPlanillaEmpleadoPago[];
  totales: {
    empleados: number;
    liquido: number;
  };
};

type PagoMaestro = {
  nombre: string | null;
  cedula: string | null;
  formaPago: string | null;
  banco: string | null;
  numCuenta: string | null;
  idCta: string | null;
};

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function normalizeCodPla(value: string): string {
  const raw = value.trim();
  if (/^\d+$/.test(raw) && raw.length < 2) return raw.padStart(2, "0");
  return raw;
}

function canalLabel(canal: RevisionPlanillaCanalPago): string {
  if (canal === "CK") return "Cheque (CK)";
  if (canal === "DAV") return "Davivienda";
  if (canal === "BN") return "Banco Nacional";
  return "Otro";
}

function parseCanal(raw: string): RevisionPlanillaCanalPago {
  const value = raw.trim().toUpperCase();
  if (value === "CK" || value === "CHEQUE" || value === "K") return "CK";
  if (value === "DAV" || value === "DAVIVIENDA") return "DAV";
  if (value === "BN" || value === "BANCO NACIONAL" || value === "NACIONAL") return "BN";
  if (value === "OTRO" || value === "OTHER") return "OTRO";
  throw new Error("Canal inválido. Use CK, DAV o BN.");
}

async function resolveCompanyLabel(noCia: string): Promise<string> {
  const companies = await prisma.company.findMany({
    where: { isActive: true },
    select: { code: true, name: true, sapCode: true },
  });
  const sapToCompany = buildSapToCompanyMap(companies);
  const companyByCode = new Map(companies.map((c) => [c.code, c]));
  const { sapCode, companyCode } = resolveCompanyFromSapCode(noCia, sapToCompany);
  const company = companyCode ? companyByCode.get(companyCode) : undefined;
  return companySapLabel(sapCode, companyCode, company?.name ?? null);
}

async function loadPagoMaestroFromArplme(noCia: string): Promise<Map<string, PagoMaestro>> {
  const map = new Map<string, PagoMaestro>();
  try {
    const rows = await withNafOracleConnection(async (conn) => {
      const result = await conn.execute<Record<string, unknown>>(
        `SELECT
           m.NO_EMPLE,
           m.NOMBRE,
           m.FORMA_PAGO,
           m.ID_CTA,
           COALESCE(d.NUM_CUENTA, m.NUM_CUENTA) AS NUM_CUENTA,
           d.BANCO,
           d.CEDULA
         FROM NAF5.ARPLME m
         LEFT JOIN NAF5.VDATOS_EMPLEADO d
           ON d.NO_CIA = m.NO_CIA AND d.NO_EMPLE = m.NO_EMPLE
         WHERE m.NO_CIA = :noCia`,
        { noCia },
      );
      return result.rows ?? [];
    });

    for (const row of rows) {
      const noEmple = asString(row.NO_EMPLE);
      if (!noEmple) continue;
      map.set(noEmple, {
        nombre: asString(row.NOMBRE),
        cedula: asString(row.CEDULA),
        formaPago: asString(row.FORMA_PAGO),
        banco: asString(row.BANCO),
        numCuenta: asString(row.NUM_CUENTA),
        idCta: asString(row.ID_CTA),
      });
    }
  } catch {
    // Sin Oracle: se usa el maestro local.
  }
  return map;
}

/**
 * Empleados de una planilla cuyo líquido se paga por el canal indicado (CK/DAV/BN),
 * con la misma clasificación que RPL3073 / revisión de planilla.
 */
export async function getRevisionPlanillaEmpleadosPorCanal(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
  canal: string;
}): Promise<RevisionPlanillaEmpleadosPagoResult> {
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const canal = parseCanal(input.canal);
  const desdeKey = calendarDateKey(parseDateInput(input.fDesde));
  const hastaKey = calendarDateKey(parseDateInput(input.fHasta));
  if (!noCia || !codPla || !desdeKey || !hastaKey) {
    throw new Error("Parámetros requeridos: noCia, codPla, fDesde, fHasta, canal");
  }

  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: { noCia, codPla },
    select: {
      ano: true,
      periodo: true,
      fDesde: true,
      fHasta: true,
      descri: true,
    },
  });

  const periods = metaRows.filter((row) => {
    if (!row.fDesde || !row.fHasta) return false;
    return calendarDateKey(row.fDesde) === desdeKey && calendarDateKey(row.fHasta) === hastaKey;
  });

  if (periods.length === 0) {
    throw new Error("No se encontró la planilla/periodo en los datos sincronizados");
  }

  const summaries = await prisma.nafNominaSummary.findMany({
    where: {
      noCia,
      codPla,
      OR: periods.map((p) => ({ ano: p.ano, periodo: p.periodo })),
    },
    select: {
      noEmple: true,
      neto: true,
      nominaNombre: true,
    },
  });

  const employeeKeys = [
    ...new Set(summaries.map((s) => nafEmployeeSourceKey(noCia, s.noEmple))),
  ];
  const [pagoByEmple, localEmployees, companyLabel] = await Promise.all([
    loadPagoMaestroFromArplme(noCia),
    employeeKeys.length
      ? prisma.nafEmployee.findMany({
          where: { sourceKey: { in: employeeKeys } },
          select: {
            noEmple: true,
            nombre: true,
            cedula: true,
            formaPago: true,
            banco: true,
            numCuenta: true,
            tipoCuenta: true,
          },
        })
      : Promise.resolve([]),
    resolveCompanyLabel(noCia),
  ]);

  const localByEmple = new Map(localEmployees.map((e) => [e.noEmple.trim(), e]));
  const empleados: RevisionPlanillaEmpleadoPago[] = [];

  for (const summary of summaries) {
    const noEmple = summary.noEmple.trim();
    const pago = pagoByEmple.get(noEmple);
    const local = localByEmple.get(noEmple);
    const classified = classifyFormaPagoCanal(
      pago?.formaPago ?? local?.formaPago,
      pago?.banco ?? local?.banco,
      pago?.idCta ?? local?.tipoCuenta,
    );
    if (classified !== canal) continue;

    const liquidoEmp = roundMoney(decimalToNumber(summary.neto));
    // Igual que Codisa / archivo bancario: no listar ni sumar líquido ≤ 0.
    if (liquidoEmp <= 0) continue;

    empleados.push({
      noEmple,
      nombre: pago?.nombre ?? local?.nombre ?? null,
      cedula: pago?.cedula ?? local?.cedula ?? null,
      formaPago: pago?.formaPago ?? local?.formaPago ?? null,
      banco: pago?.banco ?? local?.banco ?? null,
      numCuenta: pago?.numCuenta ?? local?.numCuenta ?? null,
      idCta: pago?.idCta ?? local?.tipoCuenta ?? null,
      liquido: liquidoEmp,
    });
  }

  empleados.sort((a, b) => a.noEmple.localeCompare(b.noEmple, undefined, { numeric: true }));

  const liquido = roundMoney(empleados.reduce((sum, row) => sum + row.liquido, 0));
  const nominaNombre =
    periods.find((p) => p.descri?.trim())?.descri?.trim() ||
    summaries.find((s) => s.nominaNombre?.trim())?.nominaNombre?.trim() ||
    null;

  return {
    noCia,
    companyLabel,
    codPla,
    nominaNombre,
    fDesde: input.fDesde,
    fHasta: input.fHasta,
    canal,
    canalLabel: canalLabel(canal),
    empleados,
    totales: {
      empleados: empleados.length,
      liquido,
    },
  };
}
