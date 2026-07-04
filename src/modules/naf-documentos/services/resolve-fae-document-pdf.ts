import oracledb from "oracledb";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { haciendaTipoFromConsecutivo } from "../business/naf-share-pdf-filename";

type OracleRow = Record<string, unknown>;

const NAF_TIPO_TO_FAE_TD: Record<string, string> = {
  FC: "01",
  ND: "02",
  NC: "03",
  AN: "03",
  RP: "10",
  RE: "04",
};

function faeTdFromDocument(tipoDoc: string, consecutivoFe: string): string | null {
  const fromNaf = NAF_TIPO_TO_FAE_TD[tipoDoc.trim().toUpperCase()];
  if (fromNaf) return fromNaf;
  return haciendaTipoFromConsecutivo(consecutivoFe);
}

export async function resolveFaeDocumentPdf(params: {
  noCia: string;
  tipoDoc: string;
  consecutivoFe: string;
}): Promise<{ buf: Buffer; fileName: string } | null> {
  const consecutivo = params.consecutivoFe.trim();
  if (!consecutivo) return null;

  const td = faeTdFromDocument(params.tipoDoc, consecutivo);
  const noCia = params.noCia.trim().padStart(2, "0");

  return withNafOracleConnection(async (conn) => {
    const odb = oracledb as typeof oracledb & {
      fetchAsBuffer: number[];
      BLOB: number;
    };
    odb.fetchAsBuffer = [odb.BLOB];

    const result = await conn.execute(
      `
      SELECT v.REPORTE_PDF, v.CONSECUTIVO, v.TD
      FROM FAE.VFAE_DOCUMENTOS v
      JOIN FAE.FAE_COMPANIAS c ON c.ID_COMPANIA = v.CIA
      WHERE c.NO_CIA = :noCia
        AND v.CONSECUTIVO = :consecutivo
        AND (:td IS NULL OR v.TD = :td)
        AND DBMS_LOB.GETLENGTH(v.REPORTE_PDF) > 0
      ORDER BY v.FH_CREADO DESC
      `,
      { noCia, consecutivo, td },
    );

    const row = result.rows?.[0] as OracleRow | undefined;
    if (!row) return null;

    const blob = row.REPORTE_PDF as Buffer | undefined;
    if (!blob || !Buffer.isBuffer(blob) || blob.length === 0) return null;

    const tdLabel = String(row.TD ?? td ?? "DOC");
    const fileName = `${noCia}_${tdLabel}_${consecutivo}_FAE.pdf`;
    return { buf: blob, fileName };
  });
}

export async function batchFaePdfAvailability(
  rows: { noCia: string; tipoDoc: string; consecutivoFe: string | null }[],
): Promise<Set<string>> {
  const available = new Set<string>();
  const consecutivos = [
    ...new Set(rows.map((r) => r.consecutivoFe?.trim()).filter(Boolean)),
  ] as string[];
  if (consecutivos.length === 0) return available;

  await withNafOracleConnection(async (conn) => {
    const result = await conn.execute(
      `
      SELECT c.NO_CIA, v.CONSECUTIVO
      FROM FAE.VFAE_DOCUMENTOS v
      JOIN FAE.FAE_COMPANIAS c ON c.ID_COMPANIA = v.CIA
      WHERE v.CONSECUTIVO IN (${consecutivos.map((_, i) => `:c${i}`).join(",")})
        AND DBMS_LOB.GETLENGTH(v.REPORTE_PDF) > 0
      `,
      Object.fromEntries(consecutivos.map((c, i) => [`c${i}`, c])),
    );

    for (const row of result.rows ?? []) {
      const r = row as OracleRow;
      const noCia = String(r.NO_CIA ?? "").padStart(2, "0");
      const consecutivo = String(r.CONSECUTIVO ?? "");
      available.add(`${noCia}|${consecutivo}`);
    }
  });

  return available;
}
