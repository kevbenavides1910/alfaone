import { readdir, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { FE_STORAGE_ROOT } from "@/modules/facturacion-electronica/utils/fe-storage";
import { nafPdfFileName } from "../business/naf-pdf-prefix";
import { findNafSharePdf, nafFeDocsRoot } from "./naf-fe-storage-paths";
import { resolveFaeDocumentPdf, batchFaePdfAvailability } from "./resolve-fae-document-pdf";
import { fetchNafSmbPdf, isNafSmbPdfConfigured } from "./naf-smb-pdf.service";

export type NafDocumentPdfInput = {
  noCia: string;
  companyCode: string | null;
  tipoDoc: string;
  noFactu: string;
  claveFactura: string | null;
  consecutivoFe: string | null;
};

export type NafDocumentPdfResult = {
  buf: Buffer;
  fileName: string;
  source: "fe_db" | "fe_storage" | "naf_share" | "fae_oracle" | "naf_smb";
};

async function findPdfInTree(root: string, targetFileName: string): Promise<string | null> {
  async function walk(dir: string): Promise<string | null> {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return null;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isFile() && entry.name === targetFileName) return abs;
      if (entry.isDirectory()) {
        const found = await walk(abs);
        if (found) return found;
      }
    }
    return null;
  }
  return walk(root);
}

async function resolveFromFeDatabase(
  input: NafDocumentPdfInput,
): Promise<NafDocumentPdfResult | null> {
  const clave = input.claveFactura?.trim();
  const consecutivo = input.consecutivoFe?.trim();
  if (!clave && !consecutivo) return null;

  const comprobante = await prisma.feComprobanteElectronico.findFirst({
    where: {
      deletedAt: null,
      OR: [
        ...(clave ? [{ claveNumerica: clave }] : []),
        ...(consecutivo ? [{ consecutivo }] : []),
      ],
      ...(input.companyCode
        ? { empresa: { companyCode: input.companyCode, deletedAt: null } }
        : {}),
    },
    select: {
      adjuntosPdf: {
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { storagePath: true, fileName: true, mimeType: true },
      },
    },
  });

  const adjunto = comprobante?.adjuntosPdf[0];
  if (!adjunto) return null;

  const abs = resolveUnderRoot(FE_STORAGE_ROOT, adjunto.storagePath);
  if (!abs) return null;

  const buf = await readFile(abs).catch(() => null);
  if (!buf) return null;

  return {
    buf,
    fileName: adjunto.fileName,
    source: "fe_db",
  };
}

async function resolveFromFeStorage(
  input: NafDocumentPdfInput,
): Promise<NafDocumentPdfResult | null> {
  const fileName = input.consecutivoFe
    ? nafPdfFileName(input.tipoDoc, input.consecutivoFe)
    : null;
  if (!fileName) return null;

  const companyCodes = new Set<string>();
  if (input.companyCode) companyCodes.add(input.companyCode);

  const empresas = await prisma.feEmpresa.findMany({
    where: { deletedAt: null },
    select: { companyCode: true },
  });
  for (const e of empresas) companyCodes.add(e.companyCode);

  for (const companyCode of companyCodes) {
    const pdfRoot = path.join(FE_STORAGE_ROOT, companyCode, "pdf");
    const abs = await findPdfInTree(pdfRoot, fileName);
    if (!abs) continue;
    const buf = await readFile(abs).catch(() => null);
    if (!buf) continue;
    return { buf, fileName, source: "fe_storage" };
  }

  return null;
}

async function resolveFromNafShare(
  input: NafDocumentPdfInput,
): Promise<NafDocumentPdfResult | null> {
  const root = nafFeDocsRoot();
  if (!root) return null;

  const fileName = input.consecutivoFe
    ? nafPdfFileName(input.tipoDoc, input.consecutivoFe)
    : null;

  const found = await findNafSharePdf(root, input.noCia, {
    claveFactura: input.claveFactura,
    consecutivoFe: input.consecutivoFe,
    fileName,
  });
  if (!found) return null;

  const buf = await readFile(found.absPath).catch(() => null);
  if (!buf) return null;

  return { buf, fileName: found.fileName, source: "naf_share" };
}

async function resolveFromNafSmb(
  input: NafDocumentPdfInput,
): Promise<NafDocumentPdfResult | null> {
  if (!input.consecutivoFe?.trim()) return null;

  const found = await fetchNafSmbPdf({
    noCia: input.noCia,
    tipoDoc: input.tipoDoc,
    consecutivoFe: input.consecutivoFe,
  });
  if (!found) return null;

  return {
    buf: found.buf,
    fileName: found.fileName,
    source: "naf_smb",
  };
}

async function resolveFromFaeOracle(
  input: NafDocumentPdfInput,
): Promise<NafDocumentPdfResult | null> {
  if (!input.consecutivoFe?.trim()) return null;

  const found = await resolveFaeDocumentPdf({
    noCia: input.noCia,
    tipoDoc: input.tipoDoc,
    consecutivoFe: input.consecutivoFe,
  });
  if (!found) return null;

  return {
    buf: found.buf,
    fileName: found.fileName,
    source: "fae_oracle",
  };
}

export async function resolveNafDocumentPdf(
  input: NafDocumentPdfInput,
): Promise<NafDocumentPdfResult | null> {
  if (!input.claveFactura?.trim() && !input.consecutivoFe?.trim()) {
    return null;
  }

  const resolvers = [
    resolveFromFeDatabase,
    resolveFromFaeOracle,
    resolveFromNafSmb,
    resolveFromFeStorage,
    resolveFromNafShare,
  ];
  for (const resolver of resolvers) {
    const result = await resolver(input);
    if (result) return result;
  }
  return null;
}

export async function isNafDocumentPdfAvailable(
  input: NafDocumentPdfInput,
): Promise<boolean> {
  const result = await resolveNafDocumentPdf(input);
  return result != null;
}

export async function batchNafDocumentPdfAvailability(
  rows: NafDocumentPdfInput[],
): Promise<Map<string, boolean>> {
  const map = new Map<string, boolean>();
  if (rows.length === 0) return map;

  const claves = [...new Set(rows.map((r) => r.claveFactura?.trim()).filter(Boolean))] as string[];
  const consecutivos = [
    ...new Set(rows.map((r) => r.consecutivoFe?.trim()).filter(Boolean)),
  ] as string[];

  const comprobantes = await prisma.feComprobanteElectronico.findMany({
    where: {
      deletedAt: null,
      OR: [
        ...(claves.length ? [{ claveNumerica: { in: claves } }] : []),
        ...(consecutivos.length ? [{ consecutivo: { in: consecutivos } }] : []),
      ],
    },
    select: {
      claveNumerica: true,
      consecutivo: true,
      adjuntosPdf: { where: { deletedAt: null }, take: 1, select: { id: true } },
    },
  });

  const claveHit = new Set(
    comprobantes.filter((c) => c.adjuntosPdf.length > 0).map((c) => c.claveNumerica),
  );
  const consecutivoHit = new Set(
    comprobantes.filter((c) => c.adjuntosPdf.length > 0).map((c) => c.consecutivo),
  );

  const faeAvailable = await batchFaePdfAvailability(rows);
  const smbConfigured = await isNafSmbPdfConfigured();

  for (const row of rows) {
    const id = `${row.noCia}-${row.tipoDoc}-${row.noFactu}`;
    const clave = row.claveFactura?.trim();
    const consecutivo = row.consecutivoFe?.trim();
    const noCia = row.noCia.padStart(2, "0");

    if (!clave && !consecutivo) {
      map.set(id, false);
      continue;
    }

    const inFeDb =
      Boolean((clave && claveHit.has(clave)) || (consecutivo && consecutivoHit.has(consecutivo)));
    const inFae = consecutivo ? faeAvailable.has(`${noCia}|${consecutivo}`) : false;
    const inSmb = Boolean(consecutivo && smbConfigured);

    map.set(id, inFeDb || inFae || inSmb);
  }

  return map;
}
