/**
 * Escritura NAF para Revisión de planilla.
 *
 * Reverse-engineering (lectura 2026-06-30 y catálogos):
 * - Prep. cheques/transf. → INSERT NAF5.ARPLCK
 *   BANCO = código banco destino (ID_CTA empleado; K → 01)
 *   NO_CTA = cuenta origen empresa desde NAF5.ARPLCB (por NO_CIA + ID_CTA)
 *   NO_SECUENCIA = contador por compañía + sufijo NO_CIA (p.ej. 14333602);
 *     lote BN+cheque comparte secuencia; Davivienda otra.
 *   FECHA = fecha de pago (típicamente F_HASTA de la quincena)
 *   MONTO = líquido del empleado
 * - Aprobación (Form sin PL/SQL visible): habilita prep. vía
 *   UPDATE NAF5.ARPLCP SET IND_CK_ACT='S' en la planilla abierta Calculada.
 *   El cierre a ARPLHS/ARPLHCP es proceso aparte (no se ejecuta aquí).
 */

import type oracledb from "oracledb";
import { withNafOracleConnection, withNafOracleWriteConnection } from "@/modules/empleados-naf/services/oracle-client";

export type ArplcbCuenta = {
  noCia: string;
  idCta: string;
  banco: string;
  noCta: string;
  principal: string | null;
  indCheques: string | null;
};

export type ArplckLineInsert = {
  noCia: string;
  codPla: string;
  noEmple: string;
  banco: string;
  noCta: string;
  fecha: Date;
  noSecuencia: string;
  monto: number;
};

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

export async function loadArplcbCuentas(noCia: string): Promise<ArplcbCuenta[]> {
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute<Record<string, unknown>>(
      `SELECT NO_CIA, ID_CTA, BANCO, NO_CTA, PRINCIPAL, IND_CHEQUES
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
    }));
  });
}

/**
 * Cuenta origen empresa para ARPLCK.NO_CTA / BANCO destino.
 * Davivienda (07) → ARPLCB ID_CTA 07; resto (BN/cheque) → principal BANCO 01.
 */
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
    if (!dav?.noCta) {
      throw new Error(`Sin cuenta origen Davivienda (ARPLCB) para la empresa`);
    }
    return { bancoDestino: "07", bancoOrigen: dav.banco || "07", ctaOrigen: dav.noCta };
  }

  const bn =
    cuentas.find((c) => c.idCta === "01" && c.principal === "S") ||
    cuentas.find((c) => c.banco === "01" && c.principal === "S") ||
    cuentas.find((c) => c.idCta === "01") ||
    cuentas.find((c) => c.banco === "01");
  if (!bn?.noCta) {
    throw new Error(`Sin cuenta origen BN (ARPLCB) para la empresa`);
  }
  return { bancoDestino: "01", bancoOrigen: bn.banco || "01", ctaOrigen: bn.noCta };
}

export async function nextArplckSecuenciaBase(noCia: string): Promise<number> {
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute<{ MAXS: number | null }>(
      `SELECT MAX(TO_NUMBER(SUBSTR(NO_SECUENCIA, 1, LENGTH(NO_SECUENCIA) - LENGTH(:noCia)))) AS MAXS
       FROM NAF5.ARPLCK
       WHERE NO_CIA = :noCia
         AND REGEXP_LIKE(NO_SECUENCIA, '^[0-9]+$')
         AND NO_SECUENCIA LIKE '%' || :noCia`,
      { noCia },
    );
    const max = result.rows?.[0]?.MAXS;
    const n = max == null ? 0 : Number(max);
    return (Number.isFinite(n) ? n : 0) + 1;
  });
}

export function formatArplckSecuencia(base: number, noCia: string): string {
  return `${base}${noCia}`;
}

export type AprobarPlanillaNafResult = {
  noCia: string;
  codPla: string;
  rowsUpdated: number;
  indCkAct: "S";
};

type WritableConn = {
  execute: oracledb.Connection["execute"];
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
};

function asWritable(conn: oracledb.Connection): WritableConn {
  return conn as unknown as WritableConn;
}

/**
 * Aprobación NAF (habilita prep. de cheques): IND_CK_ACT = 'S' en ARPLCP abierta.
 */
export async function aprobarPlanillaEnNaf(input: {
  noCia: string;
  codPla: string;
  fDesde: Date;
  fHasta: Date;
}): Promise<AprobarPlanillaNafResult> {
  const noCia = input.noCia.trim();
  const codPla = normalizeCodPla(input.codPla);

  return withNafOracleWriteConnection(async (raw) => {
    const conn = asWritable(raw);
    const check = await conn.execute(
      `SELECT COUNT(*) AS N
         FROM NAF5.ARPLCP
        WHERE NO_CIA = :noCia
          AND LPAD(TRIM(CODPLA), 2, '0') = :codPla
          AND TRUNC(F_DESDE) = TRUNC(:fDesde)
          AND TRUNC(F_HASTA) = TRUNC(:fHasta)
          AND ESTADO IN ('C', 'M', 'A')`,
      {
        noCia,
        codPla,
        fDesde: input.fDesde,
        fHasta: input.fHasta,
      },
    );
    const n = Number((check.rows?.[0] as { N?: number } | undefined)?.N ?? 0);
    if (n === 0) {
      throw new Error(
        "No se actualizó ARPLCP (¿planilla no abierta en NAF o fechas distintas?). Verifique sync y ESTADO Calculada.",
      );
    }

    const upd = await conn.execute(
      `UPDATE NAF5.ARPLCP
          SET IND_CK_ACT = 'S'
        WHERE NO_CIA = :noCia
          AND LPAD(TRIM(CODPLA), 2, '0') = :codPla
          AND TRUNC(F_DESDE) = TRUNC(:fDesde)
          AND TRUNC(F_HASTA) = TRUNC(:fHasta)
          AND ESTADO IN ('C', 'M', 'A')`,
      {
        noCia,
        codPla,
        fDesde: input.fDesde,
        fHasta: input.fHasta,
      },
      { autoCommit: true },
    );
    const rowsUpdated = Number((upd as { rowsAffected?: number }).rowsAffected ?? n);
    return { noCia, codPla, rowsUpdated, indCkAct: "S" };
  });
}

export async function insertArplckLines(lines: ArplckLineInsert[]): Promise<number> {
  if (lines.length === 0) return 0;
  return withNafOracleWriteConnection(async (raw) => {
    const conn = asWritable(raw);
    let inserted = 0;
    try {
      for (const line of lines) {
        await conn.execute(
          `INSERT INTO NAF5.ARPLCK (
             NO_CIA, COD_PLA, NO_EMPLE, BANCO, NO_CTA, FECHA, NO_SECUENCIA, MONTO
           ) VALUES (
             :noCia, :codPla, :noEmple, :banco, :noCta, :fecha, :noSecuencia, :monto
           )`,
          {
            noCia: line.noCia,
            codPla: normalizeCodPla(line.codPla),
            noEmple: line.noEmple,
            banco: line.banco,
            noCta: line.noCta,
            fecha: line.fecha,
            noSecuencia: line.noSecuencia,
            monto: line.monto,
          },
          { autoCommit: false },
        );
        inserted += 1;
      }
      await conn.commit();
      return inserted;
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  });
}

export async function deleteArplckForSecuencias(input: {
  noCia: string;
  codPla: string;
  secuencias: string[];
}): Promise<number> {
  if (input.secuencias.length === 0) return 0;
  return withNafOracleWriteConnection(async (conn) => {
    const binds: Record<string, string> = {
      noCia: input.noCia,
      codPla: normalizeCodPla(input.codPla),
    };
    const placeholders = input.secuencias.map((seq, i) => {
      const key = `s${i}`;
      binds[key] = seq;
      return `:${key}`;
    });
    const result = await conn.execute(
      `DELETE FROM NAF5.ARPLCK
        WHERE NO_CIA = :noCia
          AND LPAD(TRIM(COD_PLA), 2, '0') = :codPla
          AND NO_SECUENCIA IN (${placeholders.join(", ")})`,
      binds,
      { autoCommit: true },
    );
    return Number((result as { rowsAffected?: number }).rowsAffected ?? 0);
  });
}

export async function readArplcpIndCkAct(input: {
  noCia: string;
  codPla: string;
  fDesde: Date;
  fHasta: Date;
}): Promise<string | null> {
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute<Record<string, unknown>>(
      `SELECT IND_CK_ACT
         FROM NAF5.ARPLCP
        WHERE NO_CIA = :noCia
          AND LPAD(TRIM(CODPLA), 2, '0') = :codPla
          AND TRUNC(F_DESDE) = TRUNC(:fDesde)
          AND TRUNC(F_HASTA) = TRUNC(:fHasta)
          AND ROWNUM = 1`,
      {
        noCia: input.noCia,
        codPla: normalizeCodPla(input.codPla),
        fDesde: input.fDesde,
        fHasta: input.fHasta,
      },
    );
    return asString(result.rows?.[0]?.IND_CK_ACT);
  });
}

/** Test helper — ensure write connection works (SELECT 1). */
export async function pingNafWriteConnection(): Promise<boolean> {
  return withNafOracleWriteConnection(async (conn: oracledb.Connection) => {
    await conn.execute(`SELECT 1 AS OK FROM DUAL`);
    return true;
  });
}
