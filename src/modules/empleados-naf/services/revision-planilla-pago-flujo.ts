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
  loadPagosDesdeNaf,
  preparaCkEnNaf,
  readArplcpSnapshot,
  trasladarTesoreriaEnNaf,
} from "@/modules/empleados-naf/services/revision-planilla-naf-write";
import { congelarPlanilla } from "@/modules/empleados-naf/services/revision-planilla-cierre";

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
  const snap = await readArplcpSnapshot({ noCia, codPla });
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
      indCkActNaf: snap?.indCkAct ?? "N",
      updatedBy: user,
    },
    update: {
      revisada: true,
      aprobadaAt: now,
      aprobadaBy: user,
      indCkActNaf: snap?.indCkAct ?? undefined,
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
  cuenta?: string | null;
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
  const snap = await readArplcpSnapshot({ noCia, codPla });
  if (!checklist?.revisada && snap?.estado !== "A" && snap?.indCkAct !== "S") {
    throw new Error("La planilla debe estar aprobada (Revisada / estado A) antes de preparar pagos.");
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

  // Codisa/Neo: PLA_PREPARA_CK → T_CHEQUES, luego PLA_PROCESO_TRASLADO → ARPLCK
  const prep = await preparaCkEnNaf({
    noCia,
    codPla,
    fecha: fHasta,
  });
  if (!prep.ok) throw new Error(prep.message);

  let traslado: { ok: boolean; message: string; indCkAct: string | null; cuenta: string } | null =
    null;
  if (snap?.indCkAct !== "S") {
    try {
      traslado = await trasladarTesoreriaEnNaf({
        noCia,
        codPla,
        cuenta: input.cuenta,
      });
    } catch (e) {
      traslado = {
        ok: false,
        message: e instanceof Error ? e.message : String(e),
        indCkAct: null,
        cuenta: "",
      };
    }
  } else {
    traslado = {
      ok: true,
      message: "IND_CK_ACT=S: ya trasladada.",
      indCkAct: "S",
      cuenta: "",
    };
  }

  const pagos = await loadPagosDesdeNaf({
    noCia,
    codPla,
    fDesde: input.fDesde,
    fHasta: input.fHasta,
  });
  if (pagos.length === 0 && !(traslado?.ok && snap?.indCkAct === "S")) {
    throw new Error(
      `Sin líneas en T_CHEQUES/ARPLCK tras preparar. ${prep.message}` +
        (traslado ? ` · ${traslado.message}` : ""),
    );
  }

  let totalCheque = 0;
  let totalDav = 0;
  let totalBn = 0;
  let totalOtro = 0;
  const lineasPg = pagos.map((p) => {
    const canal: FormaPagoCanal = classifyFormaPagoCanal(
      p.formaPago,
      p.bancoDestino === "07" ? "DAVIVIENDA" : p.bancoDestino === "01" ? "NACIONAL" : null,
      p.idCta,
    );
    if (canal === "CK") totalCheque += p.liquido;
    else if (canal === "DAV") totalDav += p.liquido;
    else if (canal === "BN") totalBn += p.liquido;
    else totalOtro += p.liquido;
    return {
      noEmple: p.noEmple,
      nombre: p.nombre,
      cedula: p.cedula,
      formaPago: p.formaPago,
      idCta: p.idCta,
      canal,
      bancoDestino: p.bancoDestino,
      numCuenta: p.numCuenta,
      bancoOrigen: p.bancoDestino,
      ctaOrigen: p.ctaOrigen,
      noSecuencia: p.noSecuencia || "",
      liquido: p.liquido,
    };
  });

  totalCheque = roundMoney(totalCheque);
  totalDav = roundMoney(totalDav);
  totalBn = roundMoney(totalBn);
  totalOtro = roundMoney(totalOtro);
  const totalGeneral = roundMoney(totalCheque + totalDav + totalBn + totalOtro);
  const secuencias = [...new Set(lineasPg.map((l) => l.noSecuencia).filter(Boolean))];
  const now = new Date();
  const loteId = newId();
  const afterSnap = await readArplcpSnapshot({ noCia, codPla });

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
        indCkActNaf: afterSnap?.indCkAct ?? "N",
        updatedBy: user,
      },
      update: {
        generada: true,
        preparadaAt: now,
        preparadaBy: user,
        indCkActNaf: afterSnap?.indCkAct ?? undefined,
        updatedBy: user,
      },
    });
  });

  await congelarPlanilla({
    noCia,
    codPla,
    fDesde: input.fDesde,
    fHasta: input.fHasta,
    motivo: "lote",
    userLabel: user,
    reemplazar: true,
  }).catch((e) => {
    console.error("[revision-planilla] no se pudo congelar tras preparar lote", { noCia, codPla }, e);
  });

  const lote = await prisma.nafNominaPagoLote.findUniqueOrThrow({
    where: { id: loteId },
    include: { lineas: true },
  });

  const message = traslado?.ok
    ? `${prep.message} · ${traslado.message}`
    : `${prep.message}${traslado ? ` · Traslado pendiente: ${traslado.message}` : ""}`;

  return {
    lote,
    insertedNaf: lineasPg.length,
    secuencias,
    prep,
    traslado,
    message,
    ok: Boolean(prep.ok && (traslado?.ok ?? true)),
  };
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
