import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import {
  labelCxpDocumentoClase,
  labelCxpTipoDoc,
} from "../business/cxp-movimientos";

export type CxpTipoDocRow = {
  tipoDoc: string;
  descripcion: string | null;
  label: string;
  documentoClase: string | null;
  documentoClaseLabel: string;
};

export type CxpTiposDocResult = {
  rows: CxpTipoDocRow[];
  fetchedAt: string;
};

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/**
 * Catálogo de tipos de movimiento CXP desde NAF5.ARCPTD
 * (FA, NC, ND, TR, CK, …).
 */
export async function listCxpTiposDoc(): Promise<CxpTiposDocResult> {
  return withNafOracleConnection(async (conn) => {
    const result = await conn.execute(
      `
      SELECT
        t.TIPO_DOC,
        MAX(t.DESCRIPCION) AS DESCRIPCION,
        MAX(t.DOCUMENTO) AS DOCUMENTO
      FROM NAF5.ARCPTD t
      GROUP BY t.TIPO_DOC
      ORDER BY t.TIPO_DOC
      `,
    );

    const rows = ((result.rows ?? []) as OracleRow[]).map((row) => {
      const tipoDoc = asString(row.TIPO_DOC) ?? "";
      const descripcion = asString(row.DESCRIPCION);
      const documentoClase = asString(row.DOCUMENTO);
      return {
        tipoDoc,
        descripcion,
        label: labelCxpTipoDoc(tipoDoc, descripcion),
        documentoClase,
        documentoClaseLabel: labelCxpDocumentoClase(documentoClase),
      };
    });

    return { rows, fetchedAt: new Date().toISOString() };
  });
}
