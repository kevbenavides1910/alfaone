import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type { OpAssignmentRow, OpListMeta } from "@/modules/naf-operaciones/business/op-types";
import {
  asIsoDate,
  asNumber,
  asString,
  executeRows,
  type OracleRow,
} from "@/modules/naf-operaciones/services/oracle-helpers";

export type ListOpAssignmentsFilters = {
  noRol?: number;
  noCia?: string;
  noEmple?: string;
  noContrato?: string;
  /**
   * true (default): propietarios de la semana actual en AROPPR.
   * false: historial AROPCP (casi siempre F_FIN cerrado en prod).
   */
  vigentesOnly?: boolean;
  ano?: number;
  semana?: number;
  page?: number;
  pageSize?: number;
};

function mapRow(row: OracleRow): OpAssignmentRow {
  return {
    noCia: asString(row.NO_CIA),
    noEmple: asString(row.NO_EMPLE),
    noRol: asNumber(row.NO_ROL) ?? 0,
    fInicio: asIsoDate(row.F_INICIO),
    fFin: asIsoDate(row.F_FIN),
    tipo: asString(row.TIPO),
    monto: asNumber(row.MONTO),
    completo: asString(row.COMPLETO),
    noUbicacion: asString(row.NO_UBICACION),
    noContrato: asString(row.NO_CONTRATO),
    cedula: asString(row.CEDULA),
    nombreEmpleado: asString(row.NOMBRE),
    estadoEmpleado: asString(row.ESTADO_EMPLE),
  };
}

export async function listOpAssignments(
  filters: ListOpAssignmentsFilters = {},
): Promise<{ rows: OpAssignmentRow[] } & OpListMeta> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const vigentesOnly = filters.vigentesOnly !== false;

  return withNafOracleConnection(async (conn) => {
    if (vigentesOnly) {
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

      const clauses = ["p.PROPIETARIO IS NOT NULL", "p.ANO = :ano", "p.SEMANA = :sem"];
      const binds: Record<string, unknown> = {
        ano: ano ?? -1,
        sem: semana ?? -1,
      };
      if (filters.noRol != null) {
        clauses.push("p.NO_ROL = :rol");
        binds.rol = filters.noRol;
      }
      if (filters.noCia?.trim()) {
        clauses.push("p.NO_CIA_GRUPO = :cia");
        binds.cia = filters.noCia.trim();
      }
      if (filters.noEmple?.trim()) {
        clauses.push("p.PROPIETARIO = :emp");
        binds.emp = filters.noEmple.trim();
      }
      if (filters.noContrato?.trim()) {
        clauses.push("m.NO_CONTRATO = :cto");
        binds.cto = filters.noContrato.trim();
      }
      const where = clauses.join(" AND ");

      const countRows = await executeRows(
        conn,
        `SELECT COUNT(*) AS TOTAL
         FROM NAF5.AROPPR p
         LEFT JOIN NAF5.AROPMR m
           ON m.NO_CIA_GRUPO = p.NO_CIA_GRUPO
          AND m.NO_ROL = p.NO_ROL
          AND m.DIA_SEMANA = p.DIA_SEMANA
          AND (p.SEMANA_PGR IS NULL OR m.SEMANA_PGR = p.SEMANA_PGR)
         WHERE ${where}`,
        binds,
      );
      const total = asNumber(countRows[0]?.TOTAL) ?? 0;
      const rows = await executeRows(
        conn,
        `SELECT * FROM (
           SELECT inner_q.*, ROWNUM rn FROM (
             SELECT
               NVL(e.NO_CIA, p.NO_CIA_GRUPO) AS NO_CIA,
               p.PROPIETARIO AS NO_EMPLE,
               p.NO_ROL,
               ca.FECHA1 AS F_INICIO,
               ca.FECHA2 AS F_FIN,
               CAST('P' AS VARCHAR2(1)) AS TIPO,
               CAST(NULL AS NUMBER) AS MONTO,
               CAST(NULL AS VARCHAR2(1)) AS COMPLETO,
               m.NO_UBICACION,
               m.NO_CONTRATO,
               e.CEDULA,
               e.NOMBRE,
               e.ESTADO AS ESTADO_EMPLE
             FROM NAF5.AROPPR p
             LEFT JOIN NAF5.AROPMR m
               ON m.NO_CIA_GRUPO = p.NO_CIA_GRUPO
              AND m.NO_ROL = p.NO_ROL
              AND m.DIA_SEMANA = p.DIA_SEMANA
              AND (p.SEMANA_PGR IS NULL OR m.SEMANA_PGR = p.SEMANA_PGR)
             LEFT JOIN NAF5.AROPCA ca
               ON ca.ANO = p.ANO AND ca.SEMANA = p.SEMANA
             LEFT JOIN NAF5.ARPLME e
               ON e.NO_EMPLE = p.PROPIETARIO
              AND (e.NO_CIA = p.NO_CIA_GRUPO OR e.NO_CIA IS NOT NULL)
             WHERE ${where}
             ORDER BY p.NO_ROL, p.DIA_SEMANA
           ) inner_q WHERE ROWNUM <= :maxRow
         ) WHERE rn > :minRow`,
        { ...binds, maxRow: offset + pageSize, minRow: offset },
      );
      return {
        rows: rows.map(mapRow),
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      };
    }

    const clauses = ["c.NO_ROL IS NOT NULL"];
    const binds: Record<string, unknown> = {};
    if (filters.noRol != null) {
      clauses.push("c.NO_ROL = :rol");
      binds.rol = filters.noRol;
    }
    if (filters.noCia?.trim()) {
      clauses.push("c.NO_CIA = :cia");
      binds.cia = filters.noCia.trim();
    }
    if (filters.noEmple?.trim()) {
      clauses.push("c.NO_EMPLE = :emp");
      binds.emp = filters.noEmple.trim();
    }
    if (filters.noContrato?.trim()) {
      clauses.push("c.NO_CONTRATO = :cto");
      binds.cto = filters.noContrato.trim();
    }
    const where = clauses.join(" AND ");

    const countRows = await executeRows(
      conn,
      `SELECT COUNT(*) AS TOTAL FROM NAF5.AROPCP c WHERE ${where}`,
      binds,
    );
    const total = asNumber(countRows[0]?.TOTAL) ?? 0;
    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT inner_q.*, ROWNUM rn FROM (
           SELECT
             c.NO_CIA, c.NO_EMPLE, c.NO_ROL, c.F_INICIO, c.F_FIN, c.TIPO, c.MONTO,
             c.COMPLETO, c.NO_UBICACION, c.NO_CONTRATO, c.CEDULA,
             e.NOMBRE, e.ESTADO AS ESTADO_EMPLE
           FROM NAF5.AROPCP c
           LEFT JOIN NAF5.ARPLME e
             ON e.NO_CIA = c.NO_CIA AND e.NO_EMPLE = c.NO_EMPLE
           WHERE ${where}
           ORDER BY c.NO_ROL, c.NO_EMPLE, c.F_INICIO DESC NULLS LAST
         ) inner_q WHERE ROWNUM <= :maxRow
       ) WHERE rn > :minRow`,
      { ...binds, maxRow: offset + pageSize, minRow: offset },
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
