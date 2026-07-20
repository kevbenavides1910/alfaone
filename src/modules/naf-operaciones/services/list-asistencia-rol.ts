import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type { OpAsistenciaRow, OpListMeta } from "@/modules/naf-operaciones/business/op-types";
import {
  asIsoDate,
  asNumber,
  asString,
  executeRows,
  type OracleRow,
} from "@/modules/naf-operaciones/services/oracle-helpers";

export type ListOpAsistenciaFilters = {
  ano?: number;
  semana?: number;
  /** Fecha exacta YYYY-MM-DD (columna AROPPR.DIA). */
  fecha?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  noCiaGrupo?: string;
  noRol?: number;
  /** Nº empleado propietario (exacto). */
  propietario?: string;
  /** Nombre empleado (LIKE sobre ARPLME.NOMBRE). */
  nombre?: string;
  noContrato?: string;
  inconsistentesOnly?: boolean;
  page?: number;
  pageSize?: number;
};

function mapRow(row: OracleRow): OpAsistenciaRow {
  return {
    noCiaGrupo: asString(row.NO_CIA_GRUPO) ?? "",
    noRol: asNumber(row.NO_ROL) ?? 0,
    diaSemana: asString(row.DIA_SEMANA) ?? "",
    ano: asNumber(row.ANO) ?? 0,
    semana: asNumber(row.SEMANA) ?? 0,
    dia: asIsoDate(row.DIA),
    propietario: asString(row.PROPIETARIO),
    nombrePropietario: asString(row.NOMBRE_PROP),
    indEstado: asString(row.IND_ESTADO),
    indLaboral: asString(row.IND_LABORAL),
    indMarca: asString(row.IND_MARCA),
    estadoRol: asString(row.ESTADO_ROL),
    horas: asString(row.HORAS),
    salario: asNumber(row.SALARIO),
    extras: asNumber(row.EXTRAS),
    feriado: asNumber(row.FERIADO),
    observacion: asString(row.OBSERVACION),
    indInconsistencia: asString(row.IND_INCONSISTENCIA),
    noContrato: asString(row.NO_CONTRATO),
    noUbicacion: asString(row.NO_UBICACION),
  };
}

function isIsoDate(value: string | undefined): value is string {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim()));
}

export async function listOpAsistencia(
  filters: ListOpAsistenciaFilters = {},
): Promise<{ rows: OpAsistenciaRow[] } & OpListMeta> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const offset = (page - 1) * pageSize;

  const clauses = ["1=1"];
  const binds: Record<string, unknown> = {};

  if (isIsoDate(filters.fecha)) {
    clauses.push("TRUNC(p.DIA) = TO_DATE(:fecha, 'YYYY-MM-DD')");
    binds.fecha = filters.fecha.trim();
  } else {
    if (isIsoDate(filters.fechaDesde)) {
      clauses.push("TRUNC(p.DIA) >= TO_DATE(:fDesde, 'YYYY-MM-DD')");
      binds.fDesde = filters.fechaDesde!.trim();
    }
    if (isIsoDate(filters.fechaHasta)) {
      clauses.push("TRUNC(p.DIA) <= TO_DATE(:fHasta, 'YYYY-MM-DD')");
      binds.fHasta = filters.fechaHasta!.trim();
    }
  }

  // Si hay filtro por fecha concreta/rango, no forzar semana (sigue opcional).
  if (filters.ano != null) {
    clauses.push("p.ANO = :ano");
    binds.ano = filters.ano;
  }
  if (filters.semana != null) {
    clauses.push("p.SEMANA = :sem");
    binds.sem = filters.semana;
  }
  if (filters.noCiaGrupo?.trim()) {
    clauses.push("p.NO_CIA_GRUPO = :cia");
    binds.cia = filters.noCiaGrupo.trim();
  }
  if (filters.noRol != null) {
    clauses.push("p.NO_ROL = :rol");
    binds.rol = filters.noRol;
  }
  if (filters.propietario?.trim()) {
    clauses.push("p.PROPIETARIO = :prop");
    binds.prop = filters.propietario.trim();
  }
  if (filters.nombre?.trim()) {
    clauses.push(`EXISTS (
      SELECT 1 FROM NAF5.ARPLME en
      WHERE en.NO_EMPLE = p.PROPIETARIO
        AND UPPER(NVL(en.NOMBRE,' ')) LIKE '%' || UPPER(:nombre) || '%'
    )`);
    binds.nombre = filters.nombre.trim();
  }
  if (filters.noContrato?.trim()) {
    clauses.push("m.NO_CONTRATO = :cto");
    binds.cto = filters.noContrato.trim();
  }
  if (filters.inconsistentesOnly) {
    clauses.push("NVL(p.IND_INCONSISTENCIA,'N') = 'S'");
  }
  const where = clauses.join(" AND ");

  const fromSql = `
    FROM NAF5.AROPPR p
    LEFT JOIN NAF5.AROPMR m
      ON m.NO_CIA_GRUPO = p.NO_CIA_GRUPO
     AND m.NO_ROL = p.NO_ROL
     AND m.DIA_SEMANA = p.DIA_SEMANA
     AND (p.SEMANA_PGR IS NULL OR m.SEMANA_PGR = p.SEMANA_PGR)
    LEFT JOIN NAF5.ARPLME e
      ON e.NO_EMPLE = p.PROPIETARIO
     AND e.NO_CIA = p.NO_CIA_GRUPO
  `;

  return withNafOracleConnection(async (conn) => {
    const countRows = await executeRows(
      conn,
      `SELECT COUNT(*) AS TOTAL ${fromSql} WHERE ${where}`,
      binds,
    );
    const total = asNumber(countRows[0]?.TOTAL) ?? 0;

    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT inner_q.*, ROWNUM rn FROM (
           SELECT
             p.NO_CIA_GRUPO, p.NO_ROL, p.DIA_SEMANA, p.ANO, p.SEMANA, p.DIA,
             p.PROPIETARIO, p.IND_ESTADO, p.IND_LABORAL, p.IND_MARCA, p.ESTADO_ROL,
             p.HORAS, p.SALARIO, p.EXTRAS, p.FERIADO, p.OBSERVACION, p.IND_INCONSISTENCIA,
             m.NO_CONTRATO, m.NO_UBICACION,
             e.NOMBRE AS NOMBRE_PROP
           ${fromSql}
           WHERE ${where}
           ORDER BY p.DIA DESC, p.NO_ROL, p.DIA_SEMANA
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
