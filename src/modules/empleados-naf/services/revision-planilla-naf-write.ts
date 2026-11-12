/**
 * Escritura NAF para Revisión de planilla — paridad Neo/Codisa.
 *
 * Aprobar  → NAF5.PLA_APROBAR_NOMINA (M→A). No toca IND_CK_ACT.
 * Preparar → NAF5.PLA_PREPARA_CK → T_CHEQUES
 * Traslado → NAF5.PLA_PROCESO_TRASLADO → ARPLCK + IND_CK_ACT='S'
 * Archivo  → FPLCK11 lee T_CHEQUES o ARPLCK (ver banco-pago-archivos.ts)
 */

import type oracledb from "oracledb";
import {
  withNafOracleConnection,
  withNafOracleWriteConnection,
} from "@/modules/empleados-naf/services/oracle-client";

export type ArplcbCuenta = {
  noCia: string;
  idCta: string;
  banco: string;
  noCta: string;
  principal: string | null;
  indCheques: string | null;
  cliente?: string | null;
  cuenta?: string | null;
};

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

export function normalizeCodPla(value: string): string {
  const raw = value.trim();
  if (/^\d+$/.test(raw) && raw.length < 2) return raw.padStart(2, "0");
  return raw;
}

type WritableConn = {
  execute: oracledb.Connection["execute"];
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
};

function asWritable(conn: oracledb.Connection): WritableConn {
  return conn as unknown as WritableConn;
}

export async function loadArplcbCuentas(noCia: string): Promise<ArplcbCuenta[]> {
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute<Record<string, unknown>>(
      `SELECT NO_CIA, ID_CTA, BANCO, NO_CTA, PRINCIPAL, IND_CHEQUES, CLIENTE, CUENTA
       FROM NAF5.ARPLCB
       WHERE NO_CIA = :noCia
       ORDER BY ID_CTA`,
      { noCia },
    );
    return (result.rows ?? []).map((row) => ({
      noCia: asString(row.NO_CIA) ?? noCia,
      idCta: asString(row.ID_CTA) ?? "",
      banco: asString(row.BANCO) ?? "",
      noCta: asString(row.NO_CTA) ?? "",
      principal: asString(row.PRINCIPAL),
      indCheques: asString(row.IND_CHEQUES),
      cliente: asString(row.CLIENTE),
      cuenta: asString(row.CUENTA),
    }));
  });
}

/** Cuenta compañía para PLA_PROCESO_TRASLADO (ARCKMC.no_cta). */
export async function resolveCuentaTraslado(
  noCia: string,
  cuenta?: string | null,
): Promise<string> {
  if (cuenta?.trim()) return cuenta.trim();
  return withNafOracleConnection(async (conn) => {
    const principal = await conn.execute<{ NO_CTA: string }>(
      `SELECT no_cta FROM NAF5.ARPLCB
        WHERE no_cia = :cia AND principal = 'S' AND no_cta IS NOT NULL AND ROWNUM = 1`,
      { cia: noCia },
    );
    const p = asString(principal.rows?.[0]?.NO_CTA);
    if (p) return p;
    const any = await conn.execute<{ NO_CTA: string }>(
      `SELECT no_cta FROM NAF5.ARPLCB
        WHERE no_cia = :cia AND no_cta IS NOT NULL AND ROWNUM = 1`,
      { cia: noCia },
    );
    const n = asString(any.rows?.[0]?.NO_CTA);
    if (!n) {
      throw new Error(
        `Sin cuenta compañía (ARPLCB) para trasladar en ${noCia}. Indique cuenta.`,
      );
    }
    return n;
  });
}

export type ArplcpSnapshot = {
  estado: string | null;
  indCkAct: string | null;
  ppi: number;
};

export async function readArplcpSnapshot(input: {
  noCia: string;
  codPla: string;
}): Promise<ArplcpSnapshot | null> {
  const noCia = input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute<Record<string, unknown>>(
      `SELECT c.estado,
              NVL(c.ind_ck_act,'N') AS ind_ck_act,
              (SELECT COUNT(*) FROM NAF5.ARPLPPI i
                WHERE i.no_cia = c.no_cia AND i.cod_pla = c.codpla) AS ppi
         FROM NAF5.ARPLCP c
        WHERE c.no_cia = :cia
          AND LPAD(TRIM(c.codpla), 2, '0') = :cod
          AND ROWNUM = 1`,
      { cia: noCia, cod: codPla },
    );
    const row = result.rows?.[0];
    if (!row) return null;
    return {
      estado: asString(row.ESTADO),
      indCkAct: asString(row.IND_CK_ACT) || "N",
      ppi: Number(row.PPI ?? 0) || 0,
    };
  });
}

export type AprobarPlanillaNafResult = {
  noCia: string;
  codPla: string;
  estadoAnterior: string | null;
  estadoNuevo: string | null;
  alreadyApproved?: boolean;
  message: string;
};

/**
 * Aprobación Codisa/Neo: PLA_APROBAR_NOMINA (M→A).
 * No actualiza IND_CK_ACT (eso lo hace el traslado).
 */
export async function aprobarPlanillaEnNaf(input: {
  noCia: string;
  codPla: string;
  fDesde?: Date;
  fHasta?: Date;
}): Promise<AprobarPlanillaNafResult> {
  const noCia = input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const snap = await readArplcpSnapshot({ noCia, codPla });
  if (!snap) {
    throw new Error(`Planilla ${noCia}/${codPla} no existe en ARPLCP.`);
  }
  const estado = (snap.estado || "").trim();
  if (estado === "V") {
    throw new Error("Planilla en V (periodo cerrado). Aprobar no aplica.");
  }
  if (estado === "C") {
    throw new Error(
      "Estado C es adelanto AQ (FPL3051), no aprobación FPL3061. Use Nómina → Adelanto o limpie el estado.",
    );
  }
  if (estado === "A") {
    return {
      noCia,
      codPla,
      estadoAnterior: "A",
      estadoNuevo: "A",
      alreadyApproved: true,
      message: `Nómina ${noCia}/${codPla} ya está aprobada (estado A).`,
    };
  }
  if (estado !== "M") {
    throw new Error(
      `Aprobar exige estado Calculada (M). Actual=${estado || "—"}. Calcule la planilla primero.`,
    );
  }
  if (snap.ppi <= 0) {
    throw new Error("No hay prenómina (ARPLPPI). Calcule antes de aprobar.");
  }

  await withNafOracleWriteConnection(async (conn) => {
    await conn.execute(`BEGIN NAF5.PLA_APROBAR_NOMINA(:cia, :cod); END;`, {
      cia: noCia,
      cod: codPla,
    });
  });

  const after = await readArplcpSnapshot({ noCia, codPla });
  return {
    noCia,
    codPla,
    estadoAnterior: estado,
    estadoNuevo: after?.estado ?? null,
    message: `Nómina ${noCia}/${codPla} aprobada (M→A). Fechas no avanzan.`,
  };
}

export type PreparaCkResult = {
  ok: boolean;
  message: string;
  cola: number;
  colaK: number;
  colaT: number;
};

/** FPLCK01 / Neo: PLA_PREPARA_CK → cola T_CHEQUES. */
export async function preparaCkEnNaf(input: {
  noCia: string;
  codPla: string;
  fecha?: Date;
}): Promise<PreparaCkResult> {
  const noCia = input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const snap = await readArplcpSnapshot({ noCia, codPla });
  if (!snap) throw new Error(`Planilla ${noCia}/${codPla} no existe.`);
  if (snap.estado !== "A") {
    throw new Error(`Preparar exige estado A. Actual=${snap.estado || "—"}.`);
  }
  if (snap.indCkAct === "S") {
    return {
      ok: true,
      message: "IND_CK_ACT=S: tesorería ya trasladada. Preparar no duplica.",
      cola: 0,
      colaK: 0,
      colaT: 0,
    };
  }

  await withNafOracleWriteConnection(async (conn) => {
    await conn.execute(`BEGIN NAF5.PLA_PREPARA_CK(:cia, :cod, :fecha); END;`, {
      cia: noCia,
      cod: codPla,
      fecha: input.fecha ?? new Date(),
    });
  });

  const cola = await countTCheques(noCia, codPla);
  return {
    ok: true,
    message: `PLA_PREPARA_CK OK ${noCia}/${codPla}. Cola T_CHEQUES=${cola.total}.`,
    cola: cola.total,
    colaK: cola.k,
    colaT: cola.t,
  };
}

export type TrasladoResult = {
  ok: boolean;
  message: string;
  indCkAct: string | null;
  cuenta: string;
};

/** FPLCK10 / Neo: PLA_PROCESO_TRASLADO. */
export async function trasladarTesoreriaEnNaf(input: {
  noCia: string;
  codPla: string;
  cuenta?: string | null;
}): Promise<TrasladoResult> {
  const noCia = input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  const snap = await readArplcpSnapshot({ noCia, codPla });
  if (!snap) throw new Error(`Planilla ${noCia}/${codPla} no existe.`);
  if (snap.indCkAct === "S") {
    return {
      ok: true,
      message: "IND_CK_ACT=S: traslado ya hecho.",
      indCkAct: "S",
      cuenta: input.cuenta?.trim() || "",
    };
  }
  if (snap.estado !== "A") {
    throw new Error(`Trasladar exige estado A. Actual=${snap.estado || "—"}.`);
  }
  const cola = await countTCheques(noCia, codPla);
  if (cola.total <= 0) {
    throw new Error(
      "Cola T_CHEQUES vacía. Ejecute Preparar (PLA_PREPARA_CK) antes del traslado.",
    );
  }
  const cuenta = await resolveCuentaTraslado(noCia, input.cuenta);

  await withNafOracleWriteConnection(async (conn) => {
    await conn.execute(`BEGIN NAF5.PLA_PROCESO_TRASLADO(:cia, :cod, :cta); END;`, {
      cia: noCia,
      cod: codPla,
      cta: cuenta,
    });
  });

  const after = await readArplcpSnapshot({ noCia, codPla });
  const ind = after?.indCkAct || "N";
  return {
    ok: ind === "S",
    message:
      ind === "S"
        ? `PLA_PROCESO_TRASLADO OK ${noCia}/${codPla}. IND_CK_ACT=S.`
        : `Traslado terminó pero IND_CK_ACT=${ind}.`,
    indCkAct: ind,
    cuenta,
  };
}

async function countTCheques(
  noCia: string,
  codPla: string,
): Promise<{ total: number; k: number; t: number }> {
  return withNafOracleConnection(async (conn) => {
    const r = await conn.execute<Record<string, unknown>>(
      `SELECT COUNT(*) AS c,
              SUM(CASE WHEN forma_pago='K' THEN 1 ELSE 0 END) AS k,
              SUM(CASE WHEN forma_pago='T' THEN 1 ELSE 0 END) AS t
         FROM NAF5.T_CHEQUES
        WHERE no_cia = :cia AND LPAD(TRIM(cod_pla),2,'0') = :cod
          AND NVL(ind_anulado,'N')='N'`,
      { cia: noCia, cod: codPla },
    );
    const row = r.rows?.[0];
    return {
      total: Number(row?.C ?? 0) || 0,
      k: Number(row?.K ?? 0) || 0,
      t: Number(row?.T ?? 0) || 0,
    };
  });
}

export type NafPagoLinea = {
  noEmple: string;
  nombre: string | null;
  cedula: string | null;
  formaPago: string | null;
  idCta: string | null;
  numCuenta: string | null;
  bancoDestino: string;
  ctaOrigen: string;
  noSecuencia: string | null;
  liquido: number;
  fuente: "t_cheques" | "arplck";
};

/** Espejo de cola NAF tras preparar/trasladar (para lote Prisma / UI). */
export async function loadPagosDesdeNaf(input: {
  noCia: string;
  codPla: string;
  fDesde?: string;
  fHasta?: string;
}): Promise<NafPagoLinea[]> {
  const noCia = input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);
  return withNafOracleConnection(async (conn) => {
    const t = await conn.execute<Record<string, unknown>>(
      `SELECT t.no_emple,
              NVL(t.empleado, e.nombre) AS nombre,
              e.cedula,
              t.forma_pago,
              e.id_cta,
              e.num_cuenta,
              t.banco AS banco_destino,
              t.no_cta AS cta_origen,
              TO_CHAR(t.no_secuencia) AS no_secuencia,
              NVL(t.base, 0) AS liquido
         FROM NAF5.T_CHEQUES t
         JOIN NAF5.ARPLME e
           ON e.no_cia = t.no_cia AND e.no_emple = t.no_emple
        WHERE t.no_cia = :cia
          AND LPAD(TRIM(t.cod_pla),2,'0') = :cod
          AND NVL(t.ind_anulado,'N')='N'
          AND NVL(t.base,0) > 0
        ORDER BY NVL(t.empleado, e.nombre), t.no_emple`,
      { cia: noCia, cod: codPla },
    );
    if ((t.rows ?? []).length > 0) {
      return (t.rows ?? []).map((row) => ({
        noEmple: asString(row.NO_EMPLE) ?? "",
        nombre: asString(row.NOMBRE),
        cedula: asString(row.CEDULA),
        formaPago: asString(row.FORMA_PAGO),
        idCta: asString(row.ID_CTA),
        numCuenta: asString(row.NUM_CUENTA),
        bancoDestino: asString(row.BANCO_DESTINO) ?? "",
        ctaOrigen: asString(row.CTA_ORIGEN) ?? "",
        noSecuencia: asString(row.NO_SECUENCIA),
        liquido: Number(row.LIQUIDO) || 0,
        fuente: "t_cheques" as const,
      }));
    }

    const binds: Record<string, unknown> = { cia: noCia, cod: codPla };
    let fechaSql = "";
    if (input.fDesde && input.fHasta) {
      fechaSql =
        " AND TRUNC(k.fecha) BETWEEN TO_DATE(:fd,'YYYY-MM-DD') AND TO_DATE(:fh,'YYYY-MM-DD')";
      binds.fd = input.fDesde.slice(0, 10);
      binds.fh = input.fHasta.slice(0, 10);
    }
    const h = await conn.execute<Record<string, unknown>>(
      `SELECT k.no_emple,
              e.nombre,
              e.cedula,
              e.forma_pago,
              e.id_cta,
              e.num_cuenta,
              k.banco AS banco_destino,
              k.no_cta AS cta_origen,
              TO_CHAR(k.no_secuencia) AS no_secuencia,
              NVL(k.monto, 0) AS liquido
         FROM NAF5.ARPLCK k
         JOIN NAF5.ARPLME e
           ON e.no_cia = k.no_cia AND e.no_emple = k.no_emple
        WHERE k.no_cia = :cia
          AND LPAD(TRIM(k.cod_pla),2,'0') = :cod
          AND NVL(k.monto,0) > 0
          ${fechaSql}
        ORDER BY e.nombre, k.no_emple`,
      binds,
    );
    return (h.rows ?? []).map((row) => ({
      noEmple: asString(row.NO_EMPLE) ?? "",
      nombre: asString(row.NOMBRE),
      cedula: asString(row.CEDULA),
      formaPago: asString(row.FORMA_PAGO),
      idCta: asString(row.ID_CTA),
      numCuenta: asString(row.NUM_CUENTA),
      bancoDestino: asString(row.BANCO_DESTINO) ?? "",
      ctaOrigen: asString(row.CTA_ORIGEN) ?? "",
      noSecuencia: asString(row.NO_SECUENCIA),
      liquido: Number(row.LIQUIDO) || 0,
      fuente: "arplck" as const,
    }));
  });
}

/** @deprecated No usar en flujo revisión — legacy reverse-eng. */
export async function insertArplckLines(_lines: unknown[]): Promise<number> {
  throw new Error(
    "insertArplckLines deshabilitado. Use PLA_PREPARA_CK + PLA_PROCESO_TRASLADO (paridad Codisa/Neo).",
  );
}

/** @deprecated */
export async function deleteArplckForSecuencias(_input: {
  noCia: string;
  codPla: string;
  secuencias: string[];
}): Promise<number> {
  return 0;
}

/** @deprecated */
export async function nextArplckSecuenciaBase(_noCia: string): Promise<number> {
  throw new Error("nextArplckSecuenciaBase deshabilitado (paridad Codisa).");
}

/** @deprecated */
export function formatArplckSecuencia(base: number, noCia: string): string {
  return `${base}${noCia}`;
}

/** @deprecated */
export function resolveOrigenCuenta(
  cuentas: ArplcbCuenta[],
  idCta: string | null | undefined,
  formaPago: string | null | undefined,
): { bancoDestino: string; bancoOrigen: string; ctaOrigen: string } {
  const fp = (formaPago ?? "").trim().toUpperCase();
  const cta = (idCta ?? "").trim();
  const useDav = cta === "07" || (fp === "T" && cta === "07");
  if (useDav) {
    const dav = cuentas.find((c) => c.idCta === "07") ?? cuentas.find((c) => c.banco === "07");
    if (!dav?.noCta) throw new Error(`Sin cuenta origen Davivienda (ARPLCB)`);
    return { bancoDestino: "07", bancoOrigen: dav.banco || "07", ctaOrigen: dav.noCta };
  }
  const bn =
    cuentas.find((c) => c.idCta === "01" && c.principal === "S") ||
    cuentas.find((c) => c.banco === "01" && c.principal === "S") ||
    cuentas.find((c) => c.idCta === "01") ||
    cuentas.find((c) => c.banco === "01");
  if (!bn?.noCta) throw new Error(`Sin cuenta origen BN (ARPLCB)`);
  return { bancoDestino: "01", bancoOrigen: bn.banco || "01", ctaOrigen: bn.noCta };
}

export async function readArplcpIndCkAct(input: {
  noCia: string;
  codPla: string;
  fDesde: Date;
  fHasta: Date;
}): Promise<string | null> {
  const snap = await readArplcpSnapshot({ noCia: input.noCia, codPla: input.codPla });
  return snap?.indCkAct ?? null;
}

export async function pingNafWriteConnection(): Promise<boolean> {
  return withNafOracleWriteConnection(async (conn: oracledb.Connection) => {
    await conn.execute(`SELECT 1 AS OK FROM DUAL`);
    return true;
  });
}

void asWritable;
