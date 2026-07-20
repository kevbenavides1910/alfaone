import type oracledb from "oracledb";
import { normalizeCedula } from "@/modules/empleados/business/employee-identity";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type {
  VacacionesBaja,
  VacacionesCandidato,
  VacacionesConsulta,
  VacacionesEmpleo,
  VacacionesMovimientoDetalle,
  VacacionesPeriodo,
} from "@/modules/empleados-naf/business/vacaciones-types";
import {
  asIsoDate,
  asNumber,
  asString,
  executeRows,
  type OracleRow,
} from "@/modules/naf-operaciones/services/oracle-helpers";

const INCAP_TIPOS = ["002", "003", "070", "071"] as const;
/** Tipos de acción de personal que generan disfrute de vacaciones. */
const VAC_DISFRUTE_TIPOS = ["007", "008", "073", "096"] as const;

function periodSql(dateExpr: string): string {
  return `CASE
           WHEN :ann IS NULL THEN EXTRACT(YEAR FROM ${dateExpr})
           WHEN TO_CHAR(${dateExpr}, 'MMDD') >= TO_CHAR(:ann, 'MMDD')
             THEN EXTRACT(YEAR FROM ${dateExpr})
           ELSE EXTRACT(YEAR FROM ${dateExpr}) - 1
         END`;
}

function mapMovimiento(row: OracleRow): VacacionesMovimientoDetalle {
  return {
    noCia: asString(row.NO_CIA) ?? "",
    noEmple: asString(row.NO_EMPLE) ?? "",
    noAccion: asString(row.NO_ACCION),
    noTransaccion: asString(row.NO_TRANSACCION),
    tipoA: asString(row.TIPO_A),
    fInicio: asIsoDate(row.F_INICIO),
    fConclu: asIsoDate(row.F_CONCLU),
    dias: Math.round((asNumber(row.DIAS) ?? 0) * 100) / 100,
    periodo: asNumber(row.PERIODO),
    detalle: asString(row.DETALLE),
  };
}

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function mapCandidato(row: OracleRow): VacacionesCandidato {
  return {
    cedula: asString(row.CEDULA) ?? "",
    nombre: asString(row.NOMBRE) ?? "",
    noEmplePreferido: asString(row.NO_EMPLE),
    noCiaPreferida: asString(row.NO_CIA),
    fechaIngreso: asIsoDate(row.F_INGRESO),
    estado: asString(row.ESTADO),
    empleosCount: asNumber(row.EMPLEOS) ?? 1,
  };
}

/**
 * Busca personas por nombre, código (NO_EMPLE) o cédula.
 * Agrupa por CEDULA (misma persona en varias compañías).
 */
export async function searchVacacionesPersonal(
  q: string,
  limit = 25,
): Promise<VacacionesCandidato[]> {
  const term = q.trim();
  if (term.length < 2) return [];

  const take = Math.min(50, Math.max(5, limit));
  const digits = digitsOnly(term);
  const looksCodeOrCedula = digits.length >= 4 && /^[\d\-\s]+$/.test(term);

  return withNafOracleConnection(async (conn) => {
    const binds: Record<string, unknown> = { lim: take };
    let where: string;

    if (looksCodeOrCedula && digits) {
      where = `m.CEDULA IS NOT NULL
        AND (
          REGEXP_REPLACE(NVL(m.CEDULA,' '),'[^0-9]','') LIKE '%' || :digits || '%'
          OR m.NO_EMPLE LIKE '%' || :digits || '%'
          OR LTRIM(NVL(m.NO_EMPLE,'0'),'0') = LTRIM(:digits,'0')
        )`;
      binds.digits = digits;
    } else {
      where = `m.CEDULA IS NOT NULL
        AND UPPER(NVL(m.NOMBRE,' ')) LIKE '%' || UPPER(:nombre) || '%'`;
      binds.nombre = term;
    }

    const rows = await executeRows(
      conn,
      `SELECT * FROM (
         SELECT
           m.CEDULA,
           MAX(m.NOMBRE) KEEP (DENSE_RANK LAST ORDER BY
             CASE WHEN m.ESTADO='A' THEN 1 ELSE 0 END,
             NVL(m.F_INGRESO, DATE '1900-01-01')
           ) AS NOMBRE,
           MAX(m.NO_EMPLE) KEEP (DENSE_RANK LAST ORDER BY
             CASE WHEN m.ESTADO='A' THEN 1 ELSE 0 END,
             NVL(m.F_INGRESO, DATE '1900-01-01')
           ) AS NO_EMPLE,
           MAX(m.NO_CIA) KEEP (DENSE_RANK LAST ORDER BY
             CASE WHEN m.ESTADO='A' THEN 1 ELSE 0 END,
             NVL(m.F_INGRESO, DATE '1900-01-01')
           ) AS NO_CIA,
           MAX(m.F_INGRESO) KEEP (DENSE_RANK LAST ORDER BY
             CASE WHEN m.ESTADO='A' THEN 1 ELSE 0 END,
             NVL(m.F_INGRESO, DATE '1900-01-01')
           ) AS F_INGRESO,
           MAX(m.ESTADO) KEEP (DENSE_RANK LAST ORDER BY
             CASE WHEN m.ESTADO='A' THEN 1 ELSE 0 END,
             NVL(m.F_INGRESO, DATE '1900-01-01')
           ) AS ESTADO,
           COUNT(*) AS EMPLEOS
         FROM NAF5.ARPLME m
         WHERE ${where}
         GROUP BY m.CEDULA
         ORDER BY NOMBRE
       ) WHERE ROWNUM <= :lim`,
      binds,
    );

    return rows.map(mapCandidato).filter((c) => c.cedula);
  });
}

async function resolveSegmentStart(
  conn: oracledb.Connection,
  cedula: string,
): Promise<{ fechaIngreso: Date | null; ultimaBaja: Date | null; nota: string }> {
  const bajaRows = await executeRows(
    conn,
    `SELECT MAX(a.F_INICIO) AS LB
     FROM NAF5.ARPLAP a
     JOIN NAF5.ARPLME m ON m.NO_CIA = a.NO_CIA AND m.NO_EMPLE = a.NO_EMPLE
     WHERE m.CEDULA = :ced AND a.TIPO_A = '011'`,
    { ced: cedula },
  );
  const ultimaBajaRaw = bajaRows[0]?.LB;
  const ultimaBaja =
    ultimaBajaRaw instanceof Date
      ? ultimaBajaRaw
      : ultimaBajaRaw
        ? new Date(String(ultimaBajaRaw))
        : null;

  const fiRows = await executeRows(
    conn,
    `SELECT
       (SELECT MAX(F_INGRESO) FROM NAF5.ARPLME
         WHERE CEDULA = :ced AND ESTADO = 'A' AND F_INGRESO IS NOT NULL) AS FI_ACTIVO,
       (SELECT MIN(F_INGRESO) FROM NAF5.ARPLME
         WHERE CEDULA = :ced AND F_INGRESO IS NOT NULL
           AND (:lb IS NULL OR F_INGRESO >= :lb)) AS FI_POST,
       (SELECT MIN(F_INGRESO) FROM NAF5.ARPLME
         WHERE CEDULA = :ced AND F_INGRESO IS NOT NULL) AS FI_PRIMERO
     FROM DUAL`,
    { ced: cedula, lb: ultimaBaja },
  );

  const pickDate = (v: unknown): Date | null => {
    if (v == null) return null;
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
    const d = new Date(String(v));
    return Number.isNaN(d.getTime()) ? null : d;
  };

  let fechaIngreso =
    pickDate(fiRows[0]?.FI_ACTIVO) ??
    pickDate(fiRows[0]?.FI_POST) ??
    pickDate(fiRows[0]?.FI_PRIMERO);

  if (ultimaBaja && fechaIngreso && fechaIngreso < ultimaBaja) {
    fechaIngreso = ultimaBaja;
  }

  let nota =
    "Vacaciones del empleo NAF canónico (≈12 días/año). Incapacidades consolidadas por cédula en todas las compañías del segmento.";
  if (ultimaBaja) {
    const lbIso = ultimaBaja.toISOString().slice(0, 10);
    nota = `Historial cortado por acción 011 (baja) del ${lbIso}. Vacaciones e incapacidades reinician en el ingreso posterior.`;
  }

  return { fechaIngreso, ultimaBaja, nota };
}

/** Elige un solo empleo para el libro ARPLVAC (evita multiplicar 12 días × compañías). */
async function resolveCanonicalEmpleo(
  conn: oracledb.Connection,
  cedula: string,
  fechaIngreso: Date | null,
): Promise<{ noCia: string; noEmple: string } | null> {
  const rows = await executeRows(
    conn,
    `SELECT * FROM (
       SELECT
         m.NO_CIA,
         m.NO_EMPLE,
         m.ESTADO,
         m.F_INGRESO,
         (SELECT COUNT(*) FROM NAF5.ARPLVAC v
           WHERE v.NO_CIA = m.NO_CIA AND v.NO_EMPLE = m.NO_EMPLE) AS VAC_ROWS
       FROM NAF5.ARPLME m
       WHERE m.CEDULA = :ced
         AND (:fi IS NULL OR m.F_INGRESO IS NULL OR m.F_INGRESO >= :fi
              OR m.ESTADO = 'A')
       ORDER BY
         CASE WHEN m.ESTADO = 'A' THEN 0 ELSE 1 END,
         VAC_ROWS DESC,
         NVL(m.F_INGRESO, DATE '1900-01-01') DESC,
         m.NO_CIA,
         m.NO_EMPLE
     ) WHERE ROWNUM = 1`,
    { ced: cedula, fi: fechaIngreso },
  );
  const noCia = asString(rows[0]?.NO_CIA);
  const noEmple = asString(rows[0]?.NO_EMPLE);
  if (!noCia || !noEmple) return null;
  return { noCia, noEmple };
}

/**
 * Detalle de vacaciones/incapacidad para una cédula.
 * Vacaciones: un solo empleo canónico (12 días/año). Incapacidad: todas las compañías del segmento.
 */
export async function getVacacionesPersonalByCedula(
  cedulaRaw: string,
): Promise<VacacionesConsulta | null> {
  const cedula = cedulaRaw.trim();
  if (!cedula) return null;

  return withNafOracleConnection(async (conn) => {
    const me = await executeRows(
      conn,
      `SELECT NO_CIA, NO_EMPLE, NOMBRE, F_INGRESO, F_EGRESO, ESTADO, CEDULA
       FROM NAF5.ARPLME
       WHERE CEDULA = :ced
       ORDER BY CASE WHEN ESTADO='A' THEN 0 ELSE 1 END,
                NVL(F_INGRESO, DATE '1900-01-01') DESC`,
      { ced: cedula },
    );
    if (me.length === 0) {
      const cedn = normalizeCedula(cedula);
      if (!cedn) return null;
      const me2 = await executeRows(
        conn,
        `SELECT NO_CIA, NO_EMPLE, NOMBRE, F_INGRESO, F_EGRESO, ESTADO, CEDULA
         FROM NAF5.ARPLME
         WHERE REGEXP_REPLACE(NVL(CEDULA,' '),'[^0-9]','') LIKE '%' || :cedn || '%'
         ORDER BY CASE WHEN ESTADO='A' THEN 0 ELSE 1 END,
                  NVL(F_INGRESO, DATE '1900-01-01') DESC`,
        { cedn },
      );
      if (me2.length === 0) return null;
      const realCed = asString(me2[0]?.CEDULA);
      if (!realCed || realCed === cedula) return null;
      return getVacacionesPersonalByCedula(realCed);
    }

    const nombre = asString(me[0]?.NOMBRE) ?? "";
    const empleos: VacacionesEmpleo[] = me.map((r) => ({
      noCia: asString(r.NO_CIA) ?? "",
      noEmple: asString(r.NO_EMPLE) ?? "",
      nombre: asString(r.NOMBRE),
      fIngreso: asIsoDate(r.F_INGRESO),
      fEgreso: asIsoDate(r.F_EGRESO),
      estado: asString(r.ESTADO),
    }));

    const { fechaIngreso, ultimaBaja, nota } = await resolveSegmentStart(conn, cedula);
    const canonical = await resolveCanonicalEmpleo(conn, cedula, fechaIngreso);

    const bajasRows = await executeRows(
      conn,
      `SELECT a.NO_CIA, a.NO_EMPLE, a.F_INICIO
       FROM NAF5.ARPLAP a
       JOIN NAF5.ARPLME m ON m.NO_CIA = a.NO_CIA AND m.NO_EMPLE = a.NO_EMPLE
       WHERE m.CEDULA = :ced AND a.TIPO_A = '011'
       ORDER BY a.F_INICIO`,
      { ced: cedula },
    );
    const bajasHistoricas: VacacionesBaja[] = bajasRows.map((r) => ({
      noCia: asString(r.NO_CIA) ?? "",
      noEmple: asString(r.NO_EMPLE) ?? "",
      fInicio: asIsoDate(r.F_INICIO),
    }));

    const segmentBind = fechaIngreso ?? ultimaBaja;
    const anniv = fechaIngreso;

    /**
     * Período efectivo del libro:
     * - Disfrutes (-) mantienen PERIODO NAF (balance que consumen).
     * - Devengos (+) usan aniversario F_INGRESO; si NAF dejó el abono en un
     *   período anterior al ciclo (p.ej. jun-2026 → 2025), se corrige al año del ciclo.
     */
    const periodoVacSql = `CASE
           WHEN v.TIPO_MOV = '-' THEN NVL(v.PERIODO, 0)
           WHEN :ann IS NULL THEN NVL(v.PERIODO, 0)
           WHEN TO_CHAR(NVL(v.GESTION, v.FECHA_MOV), 'MMDD') <= TO_CHAR(:ann, 'MMDD')
             THEN GREATEST(
               NVL(v.PERIODO, 0),
               EXTRACT(YEAR FROM NVL(v.GESTION, v.FECHA_MOV)) - 1
             )
           ELSE GREATEST(
             NVL(v.PERIODO, 0),
             EXTRACT(YEAR FROM NVL(v.GESTION, v.FECHA_MOV))
           )
         END`;

    let periodosRows: OracleRow[] = [];
    if (canonical) {
      // Libro ARPLVAC con corrección de período en devengos (vista ARPLPERVAC puede traer el error).
      periodosRows = await executeRows(
        conn,
        `SELECT
           ${periodoVacSql} AS PERIODO,
           SUM(CASE WHEN v.TIPO_MOV = '+' THEN ABS(NVL(v.DIAS, 0)) ELSE 0 END) AS GANADOS,
           SUM(CASE WHEN v.TIPO_MOV = '-' THEN ABS(NVL(v.DIAS, 0)) ELSE 0 END) AS DISFRUTADOS
         FROM NAF5.ARPLVAC v
         WHERE v.NO_CIA = :cia AND v.NO_EMPLE = :emp
           AND (:seg IS NULL OR NVL(v.GESTION, v.FECHA_MOV) >= :seg)
         GROUP BY ${periodoVacSql}
         HAVING ${periodoVacSql} > 0
         ORDER BY 1`,
        {
          cia: canonical.noCia,
          emp: canonical.noEmple,
          seg: segmentBind,
          ann: anniv,
        },
      );
    }

    const incapTipos = INCAP_TIPOS.map((t, i) => `:t${i}`).join(",");
    const vacTipos = VAC_DISFRUTE_TIPOS.map((t, i) => `:vt${i}`).join(",");
    const incapBinds: Record<string, unknown> = {
      ced: cedula,
      seg: segmentBind,
      ann: anniv,
    };
    INCAP_TIPOS.forEach((t, i) => {
      incapBinds[`t${i}`] = t;
    });
    // Solo binds referenciados en el SQL (oracledb → ORA-01036 si sobran).
    const vacBinds: Record<string, unknown> = {
      seg: segmentBind,
      cia: canonical?.noCia ?? null,
      emp: canonical?.noEmple ?? null,
    };
    VAC_DISFRUTE_TIPOS.forEach((t, i) => {
      vacBinds[`vt${i}`] = t;
    });

    const periodoExpr = periodSql("NVL(a.F_INICIO, a.F_CONCLU)");

    // Incapacidades por período de vacaciones (aniversario F_INGRESO), todas las cias.
    const incapByPeriodo = await executeRows(
      conn,
      `SELECT
         ${periodoExpr} AS PERIODO,
         SUM(NVL(a.DIAS, NVL(a.DIAS_CAL, 0))) AS DIAS,
         COUNT(*) AS N
       FROM NAF5.ARPLAP a
       JOIN NAF5.ARPLME m ON m.NO_CIA = a.NO_CIA AND m.NO_EMPLE = a.NO_EMPLE
       WHERE m.CEDULA = :ced
         AND a.TIPO_A IN (${incapTipos})
         AND (:seg IS NULL OR NVL(a.F_INICIO, a.F_CONCLU) >= :seg)
       GROUP BY ${periodoExpr}
       ORDER BY 1`,
      incapBinds,
    );

    const incapMap = new Map<number, { dias: number; n: number }>();
    for (const r of incapByPeriodo) {
      const p = asNumber(r.PERIODO) ?? 0;
      incapMap.set(p, {
        dias: asNumber(r.DIAS) ?? 0,
        n: asNumber(r.N) ?? 0,
      });
    }

    // Detalle de disfrutes desde libro ARPLVAC (mismo PERIODO que la tabla resumen).
    // Acción de personal: se busca en cualquier empleo de la misma cédula (Walter, etc.
    // suelen tener la AP en otra cia distinta al libro canónico).
    const disfruteRows = canonical
      ? await executeRows(
          conn,
          `SELECT
             v.NO_CIA,
             v.NO_EMPLE,
             a.NO_ACCION AS NO_ACCION,
             v.NO_ACCION AS NO_TRANSACCION,
             NVL(a.TIPO_A, v.TIPO_A) AS TIPO_A,
             NVL(a.F_INICIO, NVL(v.FECHA_MOV, v.GESTION)) AS F_INICIO,
             NVL(a.F_CONCLU, NVL(v.FECHA_MOV, v.GESTION)) AS F_CONCLU,
             ABS(NVL(v.DIAS, 0)) AS DIAS,
             NVL(v.PERIODO, 0) AS PERIODO,
             a.DETALLE
           FROM NAF5.ARPLVAC v
           LEFT JOIN NAF5.ARPLAP a
             ON a.TIPO_A = v.TIPO_A
            AND a.TIPO_A IN (${vacTipos})
            AND TRUNC(NVL(a.F_INICIO, a.F_EMISION)) = TRUNC(NVL(v.FECHA_MOV, v.GESTION))
            AND EXISTS (
                  SELECT 1
                    FROM NAF5.ARPLME mv
                    JOIN NAF5.ARPLME ma ON ma.CEDULA = mv.CEDULA
                   WHERE mv.NO_CIA = v.NO_CIA
                     AND mv.NO_EMPLE = v.NO_EMPLE
                     AND ma.NO_CIA = a.NO_CIA
                     AND ma.NO_EMPLE = a.NO_EMPLE
                )
           WHERE v.NO_CIA = :cia
             AND v.NO_EMPLE = :emp
             AND v.TIPO_MOV = '-'
             AND (:seg IS NULL OR NVL(v.GESTION, v.FECHA_MOV) >= :seg)
           ORDER BY NVL(v.FECHA_MOV, v.GESTION) DESC NULLS LAST, v.PERIODO DESC, v.NO_ACCION`,
          vacBinds,
        )
      : [];

    const detalleDisfrutados = disfruteRows.map(mapMovimiento);

    const incapDetalleRows = await executeRows(
      conn,
      `SELECT
         a.NO_CIA,
         a.NO_EMPLE,
         a.NO_ACCION,
         CAST(NULL AS VARCHAR2(20)) AS NO_TRANSACCION,
         a.TIPO_A,
         a.F_INICIO,
         a.F_CONCLU,
         NVL(a.DIAS, NVL(a.DIAS_CAL, 0)) AS DIAS,
         ${periodoExpr} AS PERIODO,
         a.DETALLE
       FROM NAF5.ARPLAP a
       JOIN NAF5.ARPLME m ON m.NO_CIA = a.NO_CIA AND m.NO_EMPLE = a.NO_EMPLE
       WHERE m.CEDULA = :ced
         AND a.TIPO_A IN (${incapTipos})
         AND (:seg IS NULL OR NVL(a.F_INICIO, a.F_CONCLU) >= :seg)
       ORDER BY NVL(a.F_INICIO, a.F_CONCLU) DESC NULLS LAST, a.NO_ACCION`,
      incapBinds,
    );
    const detalleIncapacidades = incapDetalleRows.map(mapMovimiento);

    const periodoSet = new Set<number>([
      ...periodosRows.map((r) => asNumber(r.PERIODO) ?? 0),
      ...incapMap.keys(),
    ]);
    const periodosOrdenados = [...periodoSet].filter((p) => p > 0).sort((a, b) => a - b);

    const vacByPeriodo = new Map<number, { ganados: number; disfrutados: number }>();
    for (const r of periodosRows) {
      const p = asNumber(r.PERIODO) ?? 0;
      vacByPeriodo.set(p, {
        ganados: asNumber(r.GANADOS) ?? 0,
        disfrutados: asNumber(r.DISFRUTADOS) ?? 0,
      });
    }

    const periodos: VacacionesPeriodo[] = periodosOrdenados.map((periodo) => {
      const vac = vacByPeriodo.get(periodo) ?? { ganados: 0, disfrutados: 0 };
      const incap = incapMap.get(periodo) ?? { dias: 0, n: 0 };
      return {
        periodo,
        diasGanados: Math.round(vac.ganados * 100) / 100,
        diasDisfrutados: Math.round(vac.disfrutados * 100) / 100,
        diasIncapacidad: Math.round(incap.dias * 100) / 100,
        saldo: Math.round((vac.ganados - vac.disfrutados) * 100) / 100,
      };
    });

    const diasGanados = periodos.reduce((s, p) => s + p.diasGanados, 0);
    const diasDisfrutados = periodos.reduce((s, p) => s + p.diasDisfrutados, 0);
    const diasIncapacidad = periodos.reduce((s, p) => s + p.diasIncapacidad, 0);
    const incapacidadAcciones = [...incapMap.values()].reduce((s, x) => s + x.n, 0);

    const notaFinal = canonical
      ? `${nota} Libro vacaciones: ${canonical.noCia}-${canonical.noEmple}.`
      : nota;

    return {
      cedula,
      nombre,
      fechaIngreso: fechaIngreso ? fechaIngreso.toISOString().slice(0, 10) : null,
      empleoVacaciones: canonical,
      ultimaBaja011: ultimaBaja ? ultimaBaja.toISOString().slice(0, 10) : null,
      notaSegmento: notaFinal,
      empleos,
      periodos,
      totales: {
        diasGanados: Math.round(diasGanados * 100) / 100,
        diasDisfrutados: Math.round(diasDisfrutados * 100) / 100,
        saldo: Math.round((diasGanados - diasDisfrutados) * 100) / 100,
        diasIncapacidad: Math.round(diasIncapacidad * 100) / 100,
        incapacidadAcciones,
      },
      bajasHistoricas,
      detalleDisfrutados,
      detalleIncapacidades,
    };
  });
}
