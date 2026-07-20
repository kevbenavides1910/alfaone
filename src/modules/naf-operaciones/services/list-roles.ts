import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type { OpListMeta, OpRoleRow } from "@/modules/naf-operaciones/business/op-types";
import {
  asIsoTime,
  asNumber,
  asString,
  executeRows,
  type OracleRow,
} from "@/modules/naf-operaciones/services/oracle-helpers";

export type ListOpRolesFilters = {
  noCiaGrupo?: string;
  noContrato?: string;
  noUbicacion?: string;
  semanaPgr?: number;
  estado?: string;
  noRol?: number;
  q?: string;
  /** Semana calendario AROPPR (propietario); por defecto la semana actual de AROPCA. */
  ano?: number;
  semana?: number;
  page?: number;
  pageSize?: number;
};

function mapRole(row: OracleRow): OpRoleRow {
  return {
    noCiaGrupo: asString(row.NO_CIA_GRUPO) ?? "",
    noRol: asNumber(row.NO_ROL) ?? 0,
    diaSemana: asString(row.DIA_SEMANA) ?? "",
    noContrato: asString(row.NO_CONTRATO) ?? "",
    noUbicacion: asString(row.NO_UBICACION) ?? "",
    semanaPgr: asNumber(row.SEMANA_PGR) ?? 0,
    semanasPgr: asNumber(row.SEMANAS_PGR),
    estado: asString(row.ESTADO),
    tipoJornada: asString(row.TIPO_JORNADA),
    horas: asNumber(row.HORAS),
    inicio: asIsoTime(row.INICIO),
    fin: asIsoTime(row.FIN),
    perfil: asString(row.PERFIL),
    noPuesto: asString(row.NO_PUESTO),
    tipoRol: asString(row.TIPO_ROL),
    administrativo: asString(row.ADMINISTRATIVO),
    temporada: asString(row.TEMPORADA),
    noCia: asString(row.NO_CIA),
    noEmple: asString(row.NO_EMPLE),
    tipoAsig: asString(row.TIPO_ASIG),
    nombreEmpleado: asString(row.NOMBRE_EMPLE),
    ubicacionNombre: asString(row.UBICACION_NOMBRE),
  };
}

function buildWhere(filters: ListOpRolesFilters): {
  where: string;
  binds: Record<string, unknown>;
} {
  const clauses: string[] = ["1=1"];
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
  if (filters.semanaPgr != null && Number.isFinite(filters.semanaPgr)) {
    clauses.push("m.SEMANA_PGR = :spgr");
    binds.spgr = filters.semanaPgr;
  }
  const estado = filters.estado?.trim();
  if (estado && estado !== "*" && estado.toUpperCase() !== "ALL") {
    clauses.push("UPPER(NVL(m.ESTADO,' ')) = UPPER(:est)");
    binds.est = estado;
  } else if (!estado) {
    clauses.push("NVL(m.ESTADO,'A') = 'A'");
  }
  if (filters.noRol != null && Number.isFinite(filters.noRol)) {
    clauses.push("m.NO_ROL = :rol");
    binds.rol = filters.noRol;
  }
  if (filters.q?.trim()) {
    clauses.push(
      `(TO_CHAR(m.NO_ROL) LIKE '%' || :q || '%'
        OR UPPER(m.NO_CONTRATO) LIKE '%' || UPPER(:q) || '%'
        OR UPPER(NVL(p.PROPIETARIO,' ')) LIKE '%' || UPPER(:q) || '%'
        OR UPPER(NVL(e.NOMBRE,' ')) LIKE '%' || UPPER(:q) || '%')`,
    );
    binds.q = filters.q.trim();
  }

  return { where: clauses.join(" AND "), binds };
}

/**
 * Plantillas AROPMR + propietario operativo de la semana (AROPPR.PROPIETARIO).
 * AROPCP histórico casi siempre viene cerrado (F_FIN); no usarlo como SoT de asignación.
 */
export async function listOpRoles(
  filters: ListOpRolesFilters = {},
): Promise<{ rows: OpRoleRow[] } & OpListMeta> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;
  const { where, binds } = buildWhere(filters);

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

    const weekBinds = {
      ...binds,
      ano: ano ?? -1,
      sem: semana ?? -1,
    };

    const joinPr = `
      LEFT JOIN NAF5.AROPPR p
        ON p.NO_CIA_GRUPO = m.NO_CIA_GRUPO
       AND p.NO_ROL = m.NO_ROL
       AND p.DIA_SEMANA = m.DIA_SEMANA
       AND p.ANO = :ano
       AND p.SEMANA = :sem
      LEFT JOIN NAF5.ARPLME e
        ON e.NO_EMPLE = p.PROPIETARIO
       AND e.NO_CIA = m.NO_CIA_GRUPO
      LEFT JOIN NAF5.ARCOUB ub
        ON ub.NO_UBICACION = m.NO_UBICACION`;

    const allBinds = { ...weekBinds };

    const countSql = filters.q?.trim()
      ? `SELECT COUNT(*) AS TOTAL FROM (
           SELECT DISTINCT m.NO_CIA_GRUPO, m.NO_CONTRATO, m.NO_UBICACION,
                  m.NO_ROL, m.SEMANA_PGR, m.DIA_SEMANA
           FROM NAF5.AROPMR m
           ${joinPr}
           WHERE ${where}
         )`
      : `SELECT COUNT(*) AS TOTAL FROM NAF5.AROPMR m WHERE ${where}`;
    const countRows = await executeRows(
      conn,
      countSql,
      filters.q?.trim() ? allBinds : binds,
    );
    const total = asNumber(countRows[0]?.TOTAL) ?? 0;

    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT inner_q.*, ROWNUM AS rn FROM (
           SELECT
             m.NO_CIA_GRUPO, m.NO_ROL, m.DIA_SEMANA, m.NO_CONTRATO, m.NO_UBICACION,
             m.SEMANA_PGR, m.SEMANAS_PGR, m.ESTADO, m.TIPO_JORNADA, m.HORAS,
             m.INICIO, m.FIN, m.PERFIL, m.NO_PUESTO, m.TIPO_ROL,
             m.ADMINISTRATIVO, m.TEMPORADA,
             NVL(e.NO_CIA, m.NO_CIA_GRUPO) AS NO_CIA,
             p.PROPIETARIO AS NO_EMPLE,
             CAST(NULL AS VARCHAR2(1)) AS TIPO_ASIG,
             e.NOMBRE AS NOMBRE_EMPLE,
             (SELECT MAX(ub2.DESCRIPCION) FROM NAF5.ARCOUB ub2 WHERE ub2.NO_UBICACION = m.NO_UBICACION) AS UBICACION_NOMBRE
           FROM NAF5.AROPMR m
           LEFT JOIN NAF5.AROPPR p
             ON p.NO_CIA_GRUPO = m.NO_CIA_GRUPO
            AND p.NO_ROL = m.NO_ROL
            AND p.DIA_SEMANA = m.DIA_SEMANA
            AND p.ANO = :ano
            AND p.SEMANA = :sem
           LEFT JOIN NAF5.ARPLME e
             ON e.NO_EMPLE = p.PROPIETARIO
            AND e.NO_CIA = m.NO_CIA_GRUPO
           WHERE ${where}
           ORDER BY m.NO_CONTRATO, m.NO_UBICACION, m.NO_ROL, m.DIA_SEMANA, m.SEMANA_PGR
         ) inner_q
         WHERE ROWNUM <= :maxRow
       ) WHERE rn > :minRow`,
      { ...allBinds, maxRow: offset + pageSize, minRow: offset },
    );

    return {
      rows: rows.map(mapRole),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  });
}
