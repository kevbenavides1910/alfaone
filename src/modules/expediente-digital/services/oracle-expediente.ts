import type oracledb from "oracledb";
import { normalizeCedula } from "@/modules/empleados/business/employee-identity";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import type {
  ExpedienteCandidato,
  ExpedienteDocumento,
  ExpedienteEmpleo,
  ExpedienteTipoDoc,
} from "@/modules/expediente-digital/business/types";
import {
  asIsoDate,
  asNumber,
  asString,
  executeRows,
  type OracleRow,
} from "@/modules/naf-operaciones/services/oracle-helpers";
import { padNoEmple } from "@/modules/expediente-digital/business/paths";

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function mapCandidato(row: OracleRow): ExpedienteCandidato {
  return {
    cedula: asString(row.CEDULA) ?? "",
    nombre: asString(row.NOMBRE) ?? "",
    noEmplePreferido: asString(row.NO_EMPLE),
    noCiaPreferida: asString(row.NO_CIA),
    estado: asString(row.ESTADO),
    empleosCount: asNumber(row.EMPLEOS) ?? 1,
  };
}

/**
 * Busca personas por nombre, código (NO_EMPLE) o cédula.
 * Agrupa por CEDULA (misma persona en varias compañías).
 */
export async function searchExpedientePersonas(
  q: string,
  limit = 25,
): Promise<ExpedienteCandidato[]> {
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

/** Resuelve cédula canónica en Oracle (con/sin guiones) a partir de input. */
export async function resolveOracleCedula(
  cedulaRaw: string,
): Promise<string | null> {
  const raw = cedulaRaw.trim();
  if (!raw) return null;
  const cedn = normalizeCedula(raw);

  return withNafOracleConnection(async (conn) => {
    const exact = await executeRows(
      conn,
      `SELECT CEDULA FROM NAF5.ARPLME WHERE CEDULA = :ced AND ROWNUM = 1`,
      { ced: raw },
    );
    const hit = asString(exact[0]?.CEDULA);
    if (hit) return hit;

    if (!cedn) return null;
    const loose = await executeRows(
      conn,
      `SELECT CEDULA FROM NAF5.ARPLME
       WHERE REGEXP_REPLACE(NVL(CEDULA,' '),'[^0-9]','') = :cedn
         AND ROWNUM = 1`,
      { cedn },
    );
    return asString(loose[0]?.CEDULA);
  });
}

export async function listEmpleosByCedula(
  cedula: string,
): Promise<ExpedienteEmpleo[]> {
  return withNafOracleConnection(async (conn) => {
    const rows = await executeRows(
      conn,
      `SELECT NO_CIA, NO_EMPLE, NOMBRE, ESTADO, F_INGRESO
       FROM NAF5.ARPLME
       WHERE CEDULA = :ced
       ORDER BY CASE WHEN ESTADO='A' THEN 0 ELSE 1 END,
                NVL(F_INGRESO, DATE '1900-01-01') DESC`,
      { ced: cedula },
    );
    return rows.map((row) => ({
      noCia: asString(row.NO_CIA) ?? "",
      noEmple: asString(row.NO_EMPLE) ?? "",
      nombre: asString(row.NOMBRE),
      estado: asString(row.ESTADO),
      fechaIngreso: asIsoDate(row.F_INGRESO),
    })).filter((e) => e.noEmple);
  });
}

export function pickCanonicalEmpleo(
  empleos: ExpedienteEmpleo[],
): ExpedienteEmpleo | null {
  if (!empleos.length) return null;
  const activos = empleos.filter((e) => (e.estado ?? "").toUpperCase() === "A");
  const pool = activos.length ? activos : empleos;
  return pool[0] ?? null;
}

export async function listTiposDocumento(): Promise<ExpedienteTipoDoc[]> {
  return withNafOracleConnection(async (conn) => {
    const rows = await executeRows(
      conn,
      `SELECT TIPO_DOCUMENTO, DESCRIPCION, RUTA, VENCE, ESTADO, ACUMULATIVO, GENERA_VERSION
       FROM NAF5.ARPLTDS
       WHERE ESTADO = 'A'
       ORDER BY TIPO_DOCUMENTO`,
    );
    return rows.map((row) => ({
      tipoDocumento: asString(row.TIPO_DOCUMENTO) ?? "",
      descripcion: asString(row.DESCRIPCION) ?? "",
      ruta: asString(row.RUTA) ?? asString(row.TIPO_DOCUMENTO) ?? "",
      vence: (asString(row.VENCE) ?? "N").toUpperCase() === "S",
      estado: asString(row.ESTADO) ?? "A",
      acumulativo: (asString(row.ACUMULATIVO) ?? "N").toUpperCase() === "S",
      generaVersion: (asString(row.GENERA_VERSION) ?? "N").toUpperCase() === "S",
    })).filter((t) => t.tipoDocumento);
  });
}

export async function getTipoDocumento(
  tipoDoc: string,
): Promise<ExpedienteTipoDoc | null> {
  const tipo = tipoDoc.trim().toUpperCase();
  if (!tipo) return null;
  return withNafOracleConnection(async (conn) => {
    const rows = await executeRows(
      conn,
      `SELECT TIPO_DOCUMENTO, DESCRIPCION, RUTA, VENCE, ESTADO, ACUMULATIVO, GENERA_VERSION
       FROM NAF5.ARPLTDS
       WHERE UPPER(TIPO_DOCUMENTO) = :tipo AND ROWNUM = 1`,
      { tipo },
    );
    const row = rows[0];
    if (!row) return null;
    return {
      tipoDocumento: asString(row.TIPO_DOCUMENTO) ?? tipo,
      descripcion: asString(row.DESCRIPCION) ?? "",
      ruta: asString(row.RUTA) ?? tipo,
      vence: (asString(row.VENCE) ?? "N").toUpperCase() === "S",
      estado: asString(row.ESTADO) ?? "A",
      acumulativo: (asString(row.ACUMULATIVO) ?? "N").toUpperCase() === "S",
      generaVersion: (asString(row.GENERA_VERSION) ?? "N").toUpperCase() === "S",
    };
  });
}

function mapDocumento(row: OracleRow, tipoDescripcion: string): ExpedienteDocumento {
  return {
    tipoDoc: asString(row.TIPO_DOC) ?? "",
    tipoDescripcion,
    noEmple: asString(row.NO_EMPLE) ?? "",
    nVersion: asNumber(row.N_VERSION) ?? 1,
    cedula: asString(row.CEDULA),
    estado: asString(row.ESTADO),
    valido: asString(row.VALIDO),
    archivo: asString(row.ARCHIVO),
    venceDesde: asIsoDate(row.VENCE_DESDE),
    venceHasta: asIsoDate(row.VENCE_HASTA),
    fechaCreacion: asIsoDate(row.FECHA_CREACION),
    fechaModificacion: asIsoDate(row.FECHA_MODIFICACION),
  };
}

/**
 * Documentos de la persona: por CEDULA en ARPLEXPDIG + por todos sus NO_EMPLE.
 * Deduplica por (TIPO_DOC, NO_EMPLE, N_VERSION).
 */
export async function listDocumentosByCedula(
  cedula: string,
  noEmples: string[],
): Promise<ExpedienteDocumento[]> {
  const codes = Array.from(new Set(noEmples.map((c) => c.trim()).filter(Boolean)));
  const cedn = normalizeCedula(cedula);

  return withNafOracleConnection(async (conn) => {
    const binds: Record<string, unknown> = { ced: cedula };
    const orParts = [`e.CEDULA = :ced`];

    if (cedn && cedn !== cedula.replace(/\D/g, "")) {
      orParts.push(`REGEXP_REPLACE(NVL(e.CEDULA,' '),'[^0-9]','') = :cedn`);
      binds.cedn = cedn;
    } else if (cedn) {
      orParts.push(`REGEXP_REPLACE(NVL(e.CEDULA,' '),'[^0-9]','') = :cedn`);
      binds.cedn = cedn;
    }

    codes.slice(0, 80).forEach((code, i) => {
      const key = `ne${i}`;
      orParts.push(`e.NO_EMPLE = :${key}`);
      binds[key] = code;
      const pad = padNoEmple(code);
      if (pad !== code) {
        const key2 = `np${i}`;
        orParts.push(`e.NO_EMPLE = :${key2}`);
        binds[key2] = pad;
      }
    });

    const rows = await executeRows(
      conn,
      `SELECT e.TIPO_DOC, e.NO_EMPLE, e.N_VERSION, e.CEDULA, e.ESTADO, e.VALIDO,
              e.ARCHIVO, e.VENCE_DESDE, e.VENCE_HASTA, e.FECHA_CREACION, e.FECHA_MODIFICACION,
              NVL(t.DESCRIPCION, e.TIPO_DOC) AS TIPO_DESC
       FROM NAF5.ARPLEXPDIG e
       LEFT JOIN NAF5.ARPLTDS t
         ON UPPER(t.TIPO_DOCUMENTO) = UPPER(e.TIPO_DOC)
       WHERE (${orParts.join(" OR ")})
       ORDER BY e.TIPO_DOC, e.NO_EMPLE, e.N_VERSION DESC`,
      binds,
    );

    const seen = new Set<string>();
    const docs: ExpedienteDocumento[] = [];
    for (const row of rows) {
      const doc = mapDocumento(row, asString(row.TIPO_DESC) ?? "");
      const key = `${doc.tipoDoc}|${doc.noEmple}|${doc.nVersion}`;
      if (seen.has(key)) continue;
      seen.add(key);
      docs.push(doc);
    }
    return docs;
  });
}

async function nextVersion(
  conn: oracledb.Connection,
  tipoDoc: string,
  noEmple: string,
): Promise<number> {
  const rows = await executeRows(
    conn,
    `SELECT NVL(MAX(N_VERSION), 0) + 1 AS NEXT_V
     FROM NAF5.ARPLEXPDIG
     WHERE TIPO_DOC = :tipo AND NO_EMPLE = :ne`,
    { tipo: tipoDoc, ne: noEmple },
  );
  return asNumber(rows[0]?.NEXT_V) ?? 1;
}

export type UpsertExpedienteMetaInput = {
  tipoDoc: string;
  noEmple: string;
  cedula: string;
  generaVersion: boolean;
  venceDesde?: string | null;
  venceHasta?: string | null;
  actor?: string | null;
};

export async function upsertExpedienteMeta(
  input: UpsertExpedienteMetaInput,
): Promise<{ nVersion: number }> {
  const tipoDoc = input.tipoDoc.trim().toUpperCase();
  const noEmple = padNoEmple(input.noEmple);
  const actor = (input.actor?.trim() || "ALFAONE").slice(0, 100);

  return withNafOracleConnection(async (conn) => {
    let nVersion = 1;
    if (input.generaVersion) {
      nVersion = await nextVersion(conn, tipoDoc, noEmple);
    } else {
      const existing = await executeRows(
        conn,
        `SELECT * FROM (
           SELECT N_VERSION FROM NAF5.ARPLEXPDIG
           WHERE TIPO_DOC = :tipo AND NO_EMPLE = :ne
           ORDER BY N_VERSION DESC
         ) WHERE ROWNUM = 1`,
        { tipo: tipoDoc, ne: noEmple },
      );
      if (existing[0]) {
        nVersion = asNumber(existing[0].N_VERSION) ?? 1;
        await conn.execute(
          // ESTADO 'D' = convención NAF/APEX (Digital). 'A' casi no existe y APEX no lo lista.
          `UPDATE NAF5.ARPLEXPDIG SET
             CEDULA = :ced,
             ESTADO = 'D',
             VALIDO = 'S',
             ARCHIVO = 'S',
             FECHA_MODIFICACION = SYSDATE,
             EMPLE_EDITA = :actor,
             VENCE_DESDE = NVL(TO_DATE(:vd, 'YYYY-MM-DD'), VENCE_DESDE),
             VENCE_HASTA = NVL(TO_DATE(:vh, 'YYYY-MM-DD'), VENCE_HASTA)
           WHERE TIPO_DOC = :tipo AND NO_EMPLE = :ne AND N_VERSION = :ver`,
          {
            ced: input.cedula,
            actor,
            vd: input.venceDesde ?? null,
            vh: input.venceHasta ?? null,
            tipo: tipoDoc,
            ne: noEmple,
            ver: nVersion,
          },
          { autoCommit: true },
        );
        return { nVersion };
      }
    }

    await conn.execute(
      `INSERT INTO NAF5.ARPLEXPDIG (
         TIPO_DOC, NO_EMPLE, N_VERSION, VENCE_DESDE, VENCE_HASTA,
         ESTADO, FECHA_CREACION, FECHA_MODIFICACION, EMPLE_CREA, EMPLE_EDITA,
         VALIDO, CEDULA, N_VERSION_G, ARCHIVO
       ) VALUES (
         :tipo, :ne, :ver,
         TO_DATE(:vd, 'YYYY-MM-DD'), TO_DATE(:vh, 'YYYY-MM-DD'),
         'D', SYSDATE, SYSDATE, :actor, :actor,
         'S', :ced, :ver, 'S'
       )`,
      {
        tipo: tipoDoc,
        ne: noEmple,
        ver: nVersion,
        vd: input.venceDesde ?? null,
        vh: input.venceHasta ?? null,
        actor,
        ced: input.cedula,
      },
      { autoCommit: true },
    );

    return { nVersion };
  });
}
