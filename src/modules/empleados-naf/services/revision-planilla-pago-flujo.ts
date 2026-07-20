import { randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { normalizeSapCode } from "@/modules/empleados/business/company-sap";
import {
  classifyFormaPagoCanal,
  type FormaPagoCanal,
} from "@/modules/empleados-naf/business/revision-planilla-pago";
import { isNafOracleWriteConfigured } from "@/modules/empleados-naf/services/oracle-client";
import {
  aprobarPlanillaEnNaf,
  deleteArplckForSecuencias,
  formatArplckSecuencia,
  insertArplckLines,
  loadArplcbCuentas,
  nextArplckSecuenciaBase,
  resolveOrigenCuenta,
  type ArplckLineInsert,
} from "@/modules/empleados-naf/services/revision-planilla-naf-write";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";

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
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha inválida: ${value}`);
  return date;
}

function toDateOnly(value: string): Date {
  const key = calendarDateKey(parseDateInput(value));
  if (!key) throw new Error(`Fecha inválida: ${value}`);
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

function newId(): string {
  return `np_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function requireWriteConfigured() {
  if (!isNafOracleWriteConfigured()) {
    throw new Error(
      "Falta credencial de escritura NAF. Configure NAF_ORACLE_WRITE_USER y NAF_ORACLE_WRITE_PASSWORD.",
    );
  }
}

type EmpPagoRow = {
  noEmple: string;
  nombre: string | null;
  cedula: string | null;
  formaPago: string | null;
  idCta: string | null;
  numCuenta: string | null;
  liquido: number;
  canal: FormaPagoCanal;
};

async function loadEmpleadosPagoForPlanilla(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
}): Promise<EmpPagoRow[]> {
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const desdeKey = calendarDateKey(parseDateInput(input.fDesde));
  const hastaKey = calendarDateKey(parseDateInput(input.fHasta));
  if (!desdeKey || !hastaKey) throw new Error("Rango de fechas inválido");

  const metaRows = await prisma.nafNominaPeriodMeta.findMany({
    where: { noCia, codPla },
    select: { ano: true, periodo: true, fDesde: true, fHasta: true },
  });
  const periods = metaRows.filter(
    (row) =>
      row.fDesde &&
      row.fHasta &&
      calendarDateKey(row.fDesde) === desdeKey &&
      calendarDateKey(row.fHasta) === hastaKey,
  );
  if (periods.length === 0) {
    throw new Error("No se encontró la planilla/periodo sincronizado");
  }

  const summaries = await prisma.nafNominaSummary.findMany({
    where: {
      noCia,
      codPla,
      OR: periods.map((p) => ({ ano: p.ano, periodo: p.periodo })),
    },
    select: { noEmple: true, neto: true },
  });

  const maestro = await withNafOracleConnection(async (conn) => {
    const result = await conn.execute<Record<string, unknown>>(
      `SELECT m.NO_EMPLE, m.NOMBRE, m.FORMA_PAGO, m.ID_CTA,
              COALESCE(d.NUM_CUENTA, m.NUM_CUENTA) AS NUM_CUENTA,
              d.CEDULA, d.BANCO
         FROM NAF5.ARPLME m
         LEFT JOIN NAF5.VDATOS_EMPLEADO d
           ON d.NO_CIA = m.NO_CIA AND d.NO_EMPLE = m.NO_EMPLE
        WHERE m.NO_CIA = :noCia`,
      { noCia },
    );
    return result.rows ?? [];
  });

  const byEmp = new Map(
    maestro.map((row) => {
      const noEmple = String(row.NO_EMPLE ?? "").trim();
      return [
        noEmple,
        {
          nombre: row.NOMBRE != null ? String(row.NOMBRE).trim() || null : null,
          cedula: row.CEDULA != null ? String(row.CEDULA).trim() || null : null,
          formaPago: row.FORMA_PAGO != null ? String(row.FORMA_PAGO).trim() || null : null,
          idCta: row.ID_CTA != null ? String(row.ID_CTA).trim() || null : null,
          numCuenta: row.NUM_CUENTA != null ? String(row.NUM_CUENTA).trim() || null : null,
          banco: row.BANCO != null ? String(row.BANCO).trim() || null : null,
        },
      ] as const;
    }),
  );

  const out: EmpPagoRow[] = [];
  for (const s of summaries) {
    const liquido = roundMoney(decimalToNumber(s.neto));
    if (liquido <= 0) continue;
    const noEmple = s.noEmple.trim();
    const m = byEmp.get(noEmple);
    const canal = classifyFormaPagoCanal(m?.formaPago, m?.banco, m?.idCta);
    out.push({
      noEmple,
      nombre: m?.nombre ?? null,
      cedula: m?.cedula ?? null,
      formaPago: m?.formaPago ?? null,
      idCta: m?.idCta ?? null,
      numCuenta: m?.numCuenta ?? null,
      liquido,
      canal,
    });
  }
  return out;
}

export async function aprobarPlanillaFlujo(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
  userLabel?: string | null;
}) {
  requireWriteConfigured();
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const fDesde = toDateOnly(input.fDesde);
  const fHasta = toDateOnly(input.fHasta);
  const user = input.userLabel ?? null;

  const naf = await aprobarPlanillaEnNaf({ noCia, codPla, fDesde, fHasta });
  const now = new Date();
  const checklist = await prisma.nafNominaRevisionChecklist.upsert({
    where: { noCia_codPla_fDesde_fHasta: { noCia, codPla, fDesde, fHasta } },
    create: {
      noCia,
      codPla,
      fDesde,
      fHasta,
      revisada: true,
      generada: false,
      pagada: false,
      aprobadaAt: now,
      aprobadaBy: user,
      indCkActNaf: "S",
      updatedBy: user,
    },
    update: {
      revisada: true,
      aprobadaAt: now,
      aprobadaBy: user,
      indCkActNaf: "S",
      updatedBy: user,
    },
  });

  return { naf, checklist };
}

export async function prepararPagosFlujo(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
  userLabel?: string | null;
  replaceExisting?: boolean;
}) {
  requireWriteConfigured();
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const fDesde = toDateOnly(input.fDesde);
  const fHasta = toDateOnly(input.fHasta);
  const user = input.userLabel ?? null;

  const checklist = await prisma.nafNominaRevisionChecklist.findUnique({
    where: { noCia_codPla_fDesde_fHasta: { noCia, codPla, fDesde, fHasta } },
  });
  if (!checklist?.revisada) {
    throw new Error("La planilla debe estar aprobada (Revisada) antes de preparar pagos.");
  }

  const existing = await prisma.nafNominaPagoLote.findFirst({
    where: { noCia, codPla, fDesde, fHasta, estado: "preparado" },
    orderBy: { createdAt: "desc" },
  });
  if (existing && !input.replaceExisting) {
    throw new Error(
      "Ya existe un lote preparado para esta planilla. Use replaceExisting para regenerar.",
    );
  }

  if (existing && input.replaceExisting) {
    const prevSeq = Array.isArray(existing.secuencias)
      ? (existing.secuencias as string[])
      : [];
    if (prevSeq.length > 0) {
      await deleteArplckForSecuencias({ noCia, codPla, secuencias: prevSeq });
    }
  }

  const empleados = await loadEmpleadosPagoForPlanilla({
    noCia,
    codPla,
    fDesde: input.fDesde,
    fHasta: input.fHasta,
  });
  if (empleados.length === 0) {
    throw new Error("No hay empleados con líquido > 0 para preparar.");
  }

  const cuentas = await loadArplcbCuentas(noCia);
  let seqBase = await nextArplckSecuenciaBase(noCia);
  const seqBn = formatArplckSecuencia(seqBase, noCia);
  seqBase += 1;
  const seqDav = formatArplckSecuencia(seqBase, noCia);

  const lineasPg: {
    noEmple: string;
    nombre: string | null;
    cedula: string | null;
    formaPago: string | null;
    idCta: string | null;
    canal: string;
    bancoDestino: string;
    numCuenta: string | null;
    bancoOrigen: string;
    ctaOrigen: string;
    noSecuencia: string;
    liquido: number;
  }[] = [];
  const arplck: ArplckLineInsert[] = [];

  let totalCheque = 0;
  let totalDav = 0;
  let totalBn = 0;
  let totalOtro = 0;

  for (const emp of empleados) {
    const origen = resolveOrigenCuenta(cuentas, emp.idCta, emp.formaPago);
    const noSecuencia = emp.canal === "DAV" ? seqDav : seqBn;
    lineasPg.push({
      noEmple: emp.noEmple,
      nombre: emp.nombre,
      cedula: emp.cedula,
      formaPago: emp.formaPago,
      idCta: emp.idCta,
      canal: emp.canal,
      bancoDestino: origen.bancoDestino,
      numCuenta: emp.numCuenta,
      bancoOrigen: origen.bancoOrigen,
      ctaOrigen: origen.ctaOrigen,
      noSecuencia,
      liquido: emp.liquido,
    });
    arplck.push({
      noCia,
      codPla,
      noEmple: emp.noEmple,
      banco: origen.bancoDestino,
      noCta: origen.ctaOrigen,
      fecha: fHasta,
      noSecuencia,
      monto: emp.liquido,
    });
    if (emp.canal === "CK") totalCheque += emp.liquido;
    else if (emp.canal === "DAV") totalDav += emp.liquido;
    else if (emp.canal === "BN") totalBn += emp.liquido;
    else totalOtro += emp.liquido;
  }

  totalCheque = roundMoney(totalCheque);
  totalDav = roundMoney(totalDav);
  totalBn = roundMoney(totalBn);
  totalOtro = roundMoney(totalOtro);
  const totalGeneral = roundMoney(totalCheque + totalDav + totalBn + totalOtro);
  const secuencias = [...new Set(arplck.map((l) => l.noSecuencia))];

  const inserted = await insertArplckLines(arplck);
  const now = new Date();
  const loteId = newId();

  if (existing && input.replaceExisting) {
    await prisma.nafNominaPagoLote.update({
      where: { id: existing.id },
      data: { estado: "reemplazado", updatedAt: now },
    });
  }

  await prisma.$transaction(async (tx) => {
    await tx.nafNominaPagoLote.create({
      data: {
        id: loteId,
        noCia,
        codPla,
        fDesde,
        fHasta,
        fechaPago: fHasta,
        secuencias,
        estado: "preparado",
        totalCheque,
        totalDav,
        totalBn,
        totalOtro,
        totalGeneral,
        empleados: lineasPg.length,
        createdBy: user,
        updatedAt: now,
        lineas: {
          create: lineasPg.map((l) => ({
            id: newId(),
            noEmple: l.noEmple,
            nombre: l.nombre,
            cedula: l.cedula,
            formaPago: l.formaPago,
            idCta: l.idCta,
            canal: l.canal,
            bancoDestino: l.bancoDestino,
            numCuenta: l.numCuenta,
            bancoOrigen: l.bancoOrigen,
            ctaOrigen: l.ctaOrigen,
            noSecuencia: l.noSecuencia,
            liquido: new Prisma.Decimal(l.liquido),
          })),
        },
      },
    });

    await tx.nafNominaRevisionChecklist.upsert({
      where: { noCia_codPla_fDesde_fHasta: { noCia, codPla, fDesde, fHasta } },
      create: {
        noCia,
        codPla,
        fDesde,
        fHasta,
        revisada: true,
        generada: true,
        pagada: false,
        preparadaAt: now,
        preparadaBy: user,
        updatedBy: user,
      },
      update: {
        generada: true,
        preparadaAt: now,
        preparadaBy: user,
        updatedBy: user,
      },
    });
  });

  const lote = await prisma.nafNominaPagoLote.findUniqueOrThrow({
    where: { id: loteId },
    include: { lineas: true },
  });

  return { lote, insertedNaf: inserted, secuencias };
}

export async function marcarPagadaFlujo(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
  userLabel?: string | null;
}) {
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const fDesde = toDateOnly(input.fDesde);
  const fHasta = toDateOnly(input.fHasta);
  const user = input.userLabel ?? null;
  const now = new Date();

  const checklist = await prisma.nafNominaRevisionChecklist.findUnique({
    where: { noCia_codPla_fDesde_fHasta: { noCia, codPla, fDesde, fHasta } },
  });
  if (!checklist?.generada) {
    throw new Error("Debe preparar (Generada) antes de marcar Pagada.");
  }

  return prisma.nafNominaRevisionChecklist.update({
    where: { noCia_codPla_fDesde_fHasta: { noCia, codPla, fDesde, fHasta } },
    data: {
      pagada: true,
      pagadaCk: true,
      pagadaDav: true,
      pagadaBn: true,
      pagadaAt: now,
      pagadaBy: user,
      updatedBy: user,
    },
  });
}

export async function getLatestPagoLote(input: {
  noCia: string;
  codPla: string;
  fDesde: string;
  fHasta: string;
}) {
  const noCia = normalizeSapCode(input.noCia.trim()) ?? input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const fDesde = toDateOnly(input.fDesde);
  const fHasta = toDateOnly(input.fHasta);
  return prisma.nafNominaPagoLote.findFirst({
    where: { noCia, codPla, fDesde, fHasta, estado: "preparado" },
    include: { lineas: { orderBy: { noEmple: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
}
