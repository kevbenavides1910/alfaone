import { access } from "fs/promises";
import path from "path";
import { withNafOracleConnection } from "@/modules/empleados-naf/services/oracle-client";
import { resolveUnderRoot } from "@/lib/security/path-safety";

type OracleRow = Record<string, unknown>;

function asString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

/** Convierte ruta Windows de NAF (C:\FACTURAS\ALFA\FIRMADO) a relativa bajo FACTURAS/. */
export function nafWindowsPathToFacturasRelative(winPath: string): string | null {
  const normalized = winPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const match = normalized.match(/facturas\/(.+)$/i);
  if (!match?.[1]) return null;
  return match[1];
}

export type NafCompanyFePaths = {
  noCia: string;
  xmlFirmadoRel: string | null;
  xmlSinFirmaRel: string | null;
  txtProcesadosRel: string | null;
};

let pathsCache: { loadedAt: number; byNoCia: Map<string, NafCompanyFePaths> } | null = null;
const CACHE_MS = 5 * 60_000;

export async function loadNafCompanyFePaths(): Promise<Map<string, NafCompanyFePaths>> {
  const now = Date.now();
  if (pathsCache && now - pathsCache.loadedAt < CACHE_MS) {
    return pathsCache.byNoCia;
  }

  const byNoCia = await withNafOracleConnection(async (conn) => {
    const result = await conn.execute(`
      SELECT NO_CIA, XML_FIRMA, XML_SIN_FIRMA, TXT_PROCESADOS
      FROM NAF5.ARCGMC
      WHERE XML_FIRMA IS NOT NULL OR XML_SIN_FIRMA IS NOT NULL OR TXT_PROCESADOS IS NOT NULL
    `);
    const map = new Map<string, NafCompanyFePaths>();
    for (const row of result.rows ?? []) {
      const r = row as OracleRow;
      const noCia = asString(r.NO_CIA);
      if (!noCia) continue;
      map.set(noCia, {
        noCia,
        xmlFirmadoRel: asString(r.XML_FIRMA)
          ? nafWindowsPathToFacturasRelative(asString(r.XML_FIRMA)!)
          : null,
        xmlSinFirmaRel: asString(r.XML_SIN_FIRMA)
          ? nafWindowsPathToFacturasRelative(asString(r.XML_SIN_FIRMA)!)
          : null,
        txtProcesadosRel: asString(r.TXT_PROCESADOS)
          ? nafWindowsPathToFacturasRelative(asString(r.TXT_PROCESADOS)!)
          : null,
      });
      map.set(noCia.padStart(2, "0"), map.get(noCia)!);
    }
    return map;
  });

  pathsCache = { loadedAt: now, byNoCia };
  return byNoCia;
}

export function nafFeDocsRoot(): string | null {
  const explicit = process.env.NAF_FE_DOCS_ROOT?.trim();
  if (explicit) return path.resolve(explicit);
  return null;
}

async function fileExists(abs: string): Promise<boolean> {
  try {
    await access(abs);
    return true;
  } catch {
    return false;
  }
}

export async function findNafSharePdf(
  root: string,
  noCia: string,
  params: { claveFactura: string | null; consecutivoFe: string | null; fileName: string | null },
): Promise<{ absPath: string; fileName: string } | null> {
  const companyPaths = await loadNafCompanyFePaths();
  const fePaths =
    companyPaths.get(noCia) ?? companyPaths.get(noCia.padStart(2, "0"));
  if (!fePaths) return null;

  const relDirs = [
    fePaths.xmlFirmadoRel,
    fePaths.txtProcesadosRel,
    fePaths.xmlSinFirmaRel,
  ].filter((d): d is string => Boolean(d));

  const clave = params.claveFactura?.trim();
  const fileName = params.fileName?.trim();
  const candidates: string[] = [];

  for (const relDir of relDirs) {
    if (clave) {
      candidates.push(path.join(relDir, `${clave}.pdf`));
      candidates.push(path.join(relDir, `${clave}-firmado.pdf`));
    }
    if (fileName) {
      candidates.push(path.join(relDir, fileName));
    }
    if (clave) {
      candidates.push(path.join(relDir, clave, "comprobante.pdf"));
    }
  }

  for (const rel of candidates) {
    const abs = resolveUnderRoot(root, rel);
    if (!abs) continue;
    if (await fileExists(abs)) {
      return { absPath: abs, fileName: path.basename(abs) };
    }
  }

  return null;
}
