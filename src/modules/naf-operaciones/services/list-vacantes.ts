import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type { OpListMeta, OpVacanteRow } from "@/modules/naf-operaciones/business/op-types";
import {
  asIsoTime,
  asNumber,
  asString,
  executeRows,
  type OracleRow,
} from "@/modules/naf-operaciones/services/oracle-helpers";

export type ListOpVacantesFilters = {
  noCiaGrupo?: string;
  noContrato?: string;
  noUbicacion?: string;
  semanaPgr?: number;
  ano?: number;
  semana?: number;
  page?: number;
  pageSize?: number;
};

function mapRow(row: OracleRow): OpVacanteRow {
  return {
    noCiaGrupo: asString(row.NO_CIA_GRUPO) ?? "",
    noRol: asNumber(row.NO_ROL) ?? 0,
    diaSemana: asString(row.DIA_SEMANA) ?? "",
    noContrato: asString(row.NO_CONTRATO) ?? "",
    noUbicacion: asString(row.NO_UBICACION) ?? "",
    semanaPgr: asNumber(row.SEMANA_PGR) ?? 0,
    estado: asString(row.ESTADO),
    tipoJornada: asString(row.TIPO_JORNADA),
    horas: asNumber(row.HORAS),
    inicio: asIsoTime(row.INICIO),
    fin: asIsoTime(row.FIN),
    perfil: asString(row.PERFIL),
    ubicacionNombre: asString(row.UBICACION_NOMBRE),
  };
}

/**
 * Roles activos sin PROPIETARIO en AROPPR para la semana calendario operativa.
 * (AROPCP histórico aparece casi siempre cerrado; no define vacante operativa.)
 */
export async function listOpVacantes(
  filters: ListOpVacantesFilters = {},
): Promise<{ rows: OpVacanteRow[] } & OpListMeta> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const clauses = ["NVL(m.ESTADO,'A') = 'A'"];
  const binds: Record<string, unknown> = {};
  if (filters.noCiaGrupo?.trim()) {
    clauses.push("m.NO_CIA_GRUPO = :cia");
    binds.cia = filters.noCiaGrupo.trim();
  }
  if (filters.noContrato?.trim()) {
    clauses.push("m.NO_CONTRATO = :cto");
    binds.cto = filters.noContrato.trim();
  }
  if (filters.noUbicacion?.trim()) {
    clauses.push("m.NO_UBICACION = :ubi");
    binds.ubi = filters.noUbicacion.trim();
  }
  if (filters.semanaPgr != null) {
    clauses.push("m.SEMANA_PGR = :spgr");
    binds.spgr = filters.semanaPgr;
  }

  return withNafOracleConnection(async (conn) => {
    let ano = filters.ano;
    let semana = filters.semana;
    if (ano == null || semana == null) {
      const cal = await executeRows(
        conn,
        `SELECT * FROM (
           SELECT ANO, SEMANA
           FROM NAF5.AROPCA
           WHERE FECHA1 IS NOT NULL AND FECHA2 IS NOT NULL
             AND TRUNC(SYSDATE) BETWEEN TRUNC(FECHA1) AND TRUNC(FECHA2)
           ORDER BY INDICADOR DESC, ANO DESC, SEMANA DESC
         ) WHERE ROWNUM = 1`,
      );
      ano = ano ?? asNumber(cal[0]?.ANO) ?? undefined;
      semana = semana ?? asNumber(cal[0]?.SEMANA) ?? undefined;
    }

    clauses.push(`NOT EXISTS (
       SELECT 1 FROM NAF5.AROPPR p
       WHERE p.NO_CIA_GRUPO = m.NO_CIA_GRUPO
         AND p.NO_ROL = m.NO_ROL
         AND p.DIA_SEMANA = m.DIA_SEMANA
         AND p.ANO = :ano
         AND p.SEMANA = :sem
         AND p.PROPIETARIO IS NOT NULL
     )`);
    const where = clauses.join(" AND ");
    const allBinds = { ...binds, ano: ano ?? -1, sem: semana ?? -1 };

    const countRows = await executeRows(
      conn,
      `SELECT COUNT(*) AS TOTAL FROM NAF5.AROPMR m WHERE ${where}`,
      allBinds,
    );
    const total = asNumber(countRows[0]?.TOTAL) ?? 0;
    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT inner_q.*, ROWNUM rn FROM (
           SELECT
             m.NO_CIA_GRUPO, m.NO_ROL, m.DIA_SEMANA, m.NO_CONTRATO, m.NO_UBICACION,
             m.SEMANA_PGR, m.ESTADO, m.TIPO_JORNADA, m.HORAS, m.INICIO, m.FIN, m.PERFIL,
             ub.DESCRIPCION AS UBICACION_NOMBRE
           FROM NAF5.AROPMR m
           LEFT JOIN NAF5.ARCOUB ub ON ub.NO_UBICACION = m.NO_UBICACION
           WHERE ${where}
           ORDER BY m.NO_CONTRATO, m.NO_UBICACION, m.NO_ROL, m.DIA_SEMANA
         ) inner_q WHERE ROWNUM <= :maxRow
       ) WHERE rn > :minRow`,
      { ...allBinds, maxRow: offset + pageSize, minRow: offset },
    );
    return {
      rows: rows.map(mapRow),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });
}
