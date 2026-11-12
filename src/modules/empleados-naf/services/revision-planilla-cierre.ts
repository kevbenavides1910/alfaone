import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { normalizeSapCode } from "@/modules/empleados/business/company-sap";
import { nafEmployeeSourceKey } from "@/modules/empleados-naf/business/employee-key";
import {
  classifyFormaPagoCanal,
  type FormaPagoCanal,
} from "@/modules/empleados-naf/business/revision-planilla-pago";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

export type PlanillaCierreMotivo = "generada" | "lote" | "dia_pago";

export type PlanillaCierreLinea = {
  noEmple: string;
  nombre: string | null;
  cedula: string | null;
  formaPago: string | null;
  banco: string | null;
  idCta: string | null;
  numCuenta: string | null;
  canal: FormaPagoCanal;
  ingresos: number;
  deducciones: number;
  liquido: number;
};

export type PlanillaCierre = {
  noCia: string;
  codPla: string;
  motivo: string;
  fuente: string;
  nominaNombre: string | null;
  frozenAt: Date;
  frozenBy: string | null;
  lineas: PlanillaCierreLinea[];
};

const CANALES: FormaPagoCanal[] = ["CK", "DAV", "BN", "OTRO"];
const PAGO_TIME_ZONE = "America/Costa_Rica";

function calendarDateKey(value: Date | string): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const year = date.getUTCFullYear();
  return `${year}-${month}-${day}`;
}

function dateKeyOrThrow(value: string): string {
  const key = calendarDateKey(new Date(value));
  if (!key) throw new Error(`Fecha inválida: ${value}`);
  return key;
}

function keyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

function normalizeCodPla(value: string): string {
  const raw = value.trim();
  if (/^\d+$/.test(raw) && raw.length < 2) return raw.padStart(2, "0");
  return raw;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return value.toNumber();
}

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

function toCanal(value: string): FormaPagoCanal {
  const upper = value.trim().toUpperCase() as FormaPagoCanal;
  return CANALES.includes(upper) ? upper : "OTRO";
}

export function planillaCierreKey(noCia: string, codPla: string): string {
  return `${noCia}|${codPla}`;
}

function todayPagoKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PAGO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** El día de pago es fHasta (15 o fin de mes); desde el día siguiente la planilla queda congelada. */
export function isDiaPagoVencido(fHasta: string): boolean {
  return todayPagoKey() > dateKeyOrThrow(fHasta);
}

function mapCierre(row: {
  noCia: string;
  codPla: string;
  motivo: string;
  fuente: string;
  nominaNombre: string | null;
  frozenAt: Date;
  frozenBy: string | null;
  lineas: {
    noEmple: string;
    nombre: string | null;
    cedula: string | null;
    formaPago: string | null;
    banco: string | null;
    idCta: string | null;
    numCuenta: string | null;
    canal: string;
    ingresos: Prisma.Decimal;
    deducciones: Prisma.Decimal;
    liquido: Prisma.Decimal;
  }[];
}): PlanillaCierre {
  return {
    noCia: row.noCia,
    codPla: row.codPla,
    motivo: row.motivo,
    fuente: row.fuente,
    nominaNombre: row.nominaNombre,
    frozenAt: row.frozenAt,
    frozenBy: row.frozenBy,
    lineas: row.lineas.map((l) => ({
      noEmple: l.noEmple,
      nombre: l.nombre,
      cedula: l.cedula,
      formaPago: l.formaPago,
      banco: l.banco,
      idCta: l.idCta,
      numCuenta: l.numCuenta,
      canal: toCanal(l.canal),
      ingresos: decimalToNumber(l.ingresos),
      deducciones: decimalToNumber(l.deducciones),
      liquido: decimalToNumber(l.liquido),
    })),
  };
}

export async function loadPlanillaCierres(
  noCias: string[],
  fDesde: string,
  fHasta: string,
): Promise<Map<string, PlanillaCierre>> {
  const map = new Map<string, PlanillaCierre>();
  if (noCias.length === 0) return map;
  const rows = await prisma.nafNominaPlanillaCierre.findMany({
    where: {
      noCia: { in: noCias },
      fDesde: keyToDate(dateKeyOrThrow(fDesde)),
      fHasta: keyToDate(dateKeyOrThrow(fHasta)),
    },
    include: { lineas: true },
  });
  for (const row of rows) {
    map.set(planillaCierreKey(row.noCia, row.codPla), mapCierre(row));
  }
  return map;
}

export async function getPlanillaCierre(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
}): Promise<PlanillaCierre | null> {
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const row = await prisma.nafNominaPlanillaCierre.findUnique({
    where: {
      noCia_codPla_fDesde_fHasta: {
        noCia,
        codPla,
        fDesde: keyToDate(dateKeyOrThrow(input.fDesde)),
        fHasta: keyToDate(dateKeyOrThrow(input.fHasta)),
      },
    },
    include: { lineas: true },
  });
  return row ? mapCierre(row) : null;
}

type PagoMaestro = {
  nombre: string | null;
  cedula: string | null;
  formaPago: string | null;
  banco: string | null;
  numCuenta: string | null;
  idCta: string | null;
};

/** Sin Oracle no se congela: una foto con el maestro local podría fijar canales incorrectos. */
async function loadPagoMaestroArplme(noCia: string): Promise<Map<string, PagoMaestro>> {
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
  const map = new Map<string, PagoMaestro>();
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
  return map;
}

/**
 * Congela montos y canal por empleado. Si hay lote preparado, su canal manda (es lo que se pagó).
 * Devuelve null si la planilla aún no tiene montos sincronizados.
 */
export async function congelarPlanilla(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
  motivo: PlanillaCierreMotivo;
  userLabel?: string | null;
  reemplazar?: boolean;
}): Promise<PlanillaCierre | null> {
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const desdeKey = dateKeyOrThrow(input.fDesde);
  const hastaKey = dateKeyOrThrow(input.fHasta);
  const fDesde = keyToDate(desdeKey);
  const fHasta = keyToDate(hastaKey);
  const where = { noCia_codPla_fDesde_fHasta: { noCia, codPla, fDesde, fHasta } };

  if (!input.reemplazar) {
    const existing = await prisma.nafNominaPlanillaCierre.findUnique({
      where,
      include: { lineas: true },
    });
    if (existing) return mapCierre(existing);
  }

  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: { noCia, codPla },
    select: { ano: true, periodo: true, fDesde: true, fHasta: true, descri: true },
  });
  const periods = metaRows.filter(
    (row) =>
      row.fDesde &&
      row.fHasta &&
      calendarDateKey(row.fDesde) === desdeKey &&
      calendarDateKey(row.fHasta) === hastaKey,
  );
  if (periods.length === 0) return null;

  const summaries = await prisma.nafNominaSummary.findMany({
    where: { noCia, codPla, OR: periods.map((p) => ({ ano: p.ano, periodo: p.periodo })) },
    select: { noEmple: true, nominaNombre: true, devengado: true, deducciones: true, neto: true },
  });
  if (summaries.length === 0) return null;

  const lote = await prisma.nafNominaPagoLote.findFirst({
    where: { noCia, codPla, fDesde, fHasta, estado: "preparado" },
    include: { lineas: true },
    orderBy: { createdAt: "desc" },
  });
  const loteByEmple = new Map((lote?.lineas ?? []).map((l) => [l.noEmple.trim(), l]));

  const maestro = await loadPagoMaestroArplme(noCia);
  const employeeKeys = [...new Set(summaries.map((s) => nafEmployeeSourceKey(noCia, s.noEmple)))];
  const locales = await prisma.nafEmployee.findMany({
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
  });
  const localByEmple = new Map(locales.map((e) => [e.noEmple.trim(), e]));

  const lineasByEmple = new Map<string, PlanillaCierreLinea>();
  for (const s of summaries) {
    const noEmple = s.noEmple.trim();
    const m = maestro.get(noEmple);
    const local = localByEmple.get(noEmple);
    const loteLinea = loteByEmple.get(noEmple);
    const formaPago = loteLinea?.formaPago ?? m?.formaPago ?? local?.formaPago ?? null;
    const banco = m?.banco ?? local?.banco ?? null;
    const idCta = loteLinea?.idCta ?? m?.idCta ?? local?.tipoCuenta ?? null;
    const prev = lineasByEmple.get(noEmple);
    const linea: PlanillaCierreLinea = prev ?? {
      noEmple,
      nombre: loteLinea?.nombre ?? m?.nombre ?? local?.nombre ?? null,
      cedula: loteLinea?.cedula ?? m?.cedula ?? local?.cedula ?? null,
      formaPago,
      banco,
      idCta,
      numCuenta: loteLinea?.numCuenta ?? m?.numCuenta ?? local?.numCuenta ?? null,
      canal: loteLinea ? toCanal(loteLinea.canal) : classifyFormaPagoCanal(formaPago, banco, idCta),
      ingresos: 0,
      deducciones: 0,
      liquido: 0,
    };
    linea.ingresos = roundMoney(linea.ingresos + decimalToNumber(s.devengado));
    linea.deducciones = roundMoney(linea.deducciones + decimalToNumber(s.deducciones));
    linea.liquido = roundMoney(linea.liquido + decimalToNumber(s.neto));
    lineasByEmple.set(noEmple, linea);
  }
  const lineas = [...lineasByEmple.values()];

  const nominaNombre =
    periods.find((p) => p.descri?.trim())?.descri?.trim() ||
    summaries.find((s) => s.nominaNombre?.trim())?.nominaNombre?.trim() ||
    null;
  const sum = (pick: (l: PlanillaCierreLinea) => number) =>
    roundMoney(lineas.reduce((acc, l) => acc + pick(l), 0));

  try {
    await prisma.$transaction(async (tx) => {
      if (input.reemplazar) {
        await tx.nafNominaPlanillaCierre.deleteMany({ where: { noCia, codPla, fDesde, fHasta } });
      }
      await tx.nafNominaPlanillaCierre.create({
        data: {
          noCia,
          codPla,
          fDesde,
          fHasta,
          motivo: input.motivo,
          fuente: lote ? "lote" : "naf",
          nominaNombre,
          empleados: lineas.length,
          ingresos: new Prisma.Decimal(sum((l) => l.ingresos)),
          deducciones: new Prisma.Decimal(sum((l) => l.deducciones)),
          liquido: new Prisma.Decimal(sum((l) => l.liquido)),
          frozenBy: input.userLabel ?? null,
          lineas: {
            create: lineas.map((l) => ({
              noEmple: l.noEmple,
              nombre: l.nombre,
              cedula: l.cedula,
              formaPago: l.formaPago,
              banco: l.banco,
              idCta: l.idCta,
              numCuenta: l.numCuenta,
              canal: l.canal,
              ingresos: new Prisma.Decimal(l.ingresos),
              deducciones: new Prisma.Decimal(l.deducciones),
              liquido: new Prisma.Decimal(l.liquido),
            })),
          },
        },
      });
    });
  } catch (e) {
    // Otra petición la congeló primero: se respeta esa foto.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }

  const saved = await prisma.nafNominaPlanillaCierre.findUnique({
    where,
    include: { lineas: true },
  });
  return saved ? mapCierre(saved) : null;
}

/** Solo antes del día de pago: después, la foto es definitiva. */
export async function descongelarPlanilla(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
}): Promise<boolean> {
  if (isDiaPagoVencido(input.fHasta)) return false;
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const result = await prisma.nafNominaPlanillaCierre.deleteMany({
    where: {
      noCia,
      codPla,
      fDesde: keyToDate(dateKeyOrThrow(input.fDesde)),
      fHasta: keyToDate(dateKeyOrThrow(input.fHasta)),
    },
  });
  return result.count > 0;
}
