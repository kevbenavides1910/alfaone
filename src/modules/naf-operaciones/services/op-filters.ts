import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type { OpCalendarWeek } from "@/modules/naf-operaciones/business/op-types";
import {
  asIsoDate,
  asNumber,
  asString,
  executeRows,
} from "@/modules/naf-operaciones/services/oracle-helpers";

function mapWeek(row: Record<string, unknown>): OpCalendarWeek {
  return {
    ano: asNumber(row.ANO) ?? 0,
    semana: asNumber(row.SEMANA) ?? 0,
    fecha1: asIsoDate(row.FECHA1),
    fecha2: asIsoDate(row.FECHA2),
    indicador: asString(row.INDICADOR),
    mes: asNumber(row.MES),
  };
}

/** Semana operativa cuya franja FECHA1–FECHA2 contiene hoy. */
export async function getCurrentOpCalendarWeek(): Promise<OpCalendarWeek | null> {
  return withNafOracleConnection(async (conn) => {
    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT ANO, SEMANA, FECHA1, FECHA2, INDICADOR, MES
         FROM NAF5.AROPCA
         WHERE FECHA1 IS NOT NULL AND FECHA2 IS NOT NULL
           AND TRUNC(SYSDATE) BETWEEN TRUNC(FECHA1) AND TRUNC(FECHA2)
         ORDER BY INDICADOR DESC, ANO DESC, SEMANA DESC
       ) WHERE ROWNUM = 1`,
    );
    return rows[0] ? mapWeek(rows[0]) : null;
  });
}

export async function listOpCalendarWeeks(limit = 20): Promise<OpCalendarWeek[]> {
  const take = Math.min(52, Math.max(1, limit));
  return withNafOracleConnection(async (conn) => {
    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT ANO, SEMANA, FECHA1, FECHA2, INDICADOR, MES
         FROM NAF5.AROPCA
         WHERE FECHA1 IS NOT NULL
         ORDER BY ANO DESC, SEMANA DESC
       ) WHERE ROWNUM <= :lim`,
      { lim: take },
    );
    return rows.map(mapWeek);
  });
}

export async function listOpCompanies(): Promise<
  Array<{ noCiaGrupo: string; nombreGrupo: string | null }>
> {
  return withNafOracleConnection(async (conn) => {
    const fromMc = await executeRows(
      conn,
      `SELECT NO_CIA_GRUPO, NOMBRE_GRUPO FROM NAF5.AROPMC ORDER BY NO_CIA_GRUPO`,
    );
    if (fromMc.length > 0) {
      return fromMc.map((r) => ({
        noCiaGrupo: asString(r.NO_CIA_GRUPO) ?? "",
        nombreGrupo: asString(r.NOMBRE_GRUPO),
      }));
    }
    const distinct = await executeRows(
      conn,
      `SELECT NO_CIA_GRUPO FROM NAF5.AROPMR GROUP BY NO_CIA_GRUPO ORDER BY 1`,
    );
    return distinct.map((r) => ({
      noCiaGrupo: asString(r.NO_CIA_GRUPO) ?? "",
      nombreGrupo: null,
    }));
  });
}

export async function listOpContratos(noCiaGrupo?: string): Promise<string[]> {
  return withNafOracleConnection(async (conn) => {
    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT DISTINCT NO_CONTRATO
         FROM NAF5.AROPMR
         WHERE NO_CONTRATO IS NOT NULL
           AND (:cia IS NULL OR NO_CIA_GRUPO = :cia)
         ORDER BY NO_CONTRATO
       ) WHERE ROWNUM <= 500`,
      { cia: noCiaGrupo?.trim() || null },
    );
    return rows.map((r) => asString(r.NO_CONTRATO)).filter((x): x is string => Boolean(x));
  });
}

export async function listOpUbicaciones(filters?: {
  noCiaGrupo?: string;
  noContrato?: string;
}): Promise<Array<{ noUbicacion: string; nombre: string | null }>> {
  return withNafOracleConnection(async (conn) => {
    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT DISTINCT m.NO_UBICACION,
                MAX(ub.DESCRIPCION) AS DESCRIPCION
         FROM NAF5.AROPMR m
         LEFT JOIN NAF5.ARCOUB ub
           ON ub.NO_UBICACION = m.NO_UBICACION
         WHERE m.NO_UBICACION IS NOT NULL
           AND (:cia IS NULL OR m.NO_CIA_GRUPO = :cia)
           AND (:cto IS NULL OR m.NO_CONTRATO = :cto)
         GROUP BY m.NO_UBICACION
         ORDER BY m.NO_UBICACION
       ) WHERE ROWNUM <= 500`,
      {
        cia: filters?.noCiaGrupo?.trim() || null,
        cto: filters?.noContrato?.trim() || null,
      },
    );
    return rows.map((r) => ({
      noUbicacion: asString(r.NO_UBICACION) ?? "",
      nombre: asString(r.DESCRIPCION),
    }));
  });
}
