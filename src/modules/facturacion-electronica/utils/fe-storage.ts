import fs from "fs/promises";
import path from "path";
import { appDataRoot, STORAGE_DIRS } from "@/lib/storage/paths";

export const FE_STORAGE_ROOT = path.join(appDataRoot(), STORAGE_DIRS.feElectronica);

export function feCompanyRoot(companyCode: string) {
  return path.join(FE_STORAGE_ROOT, companyCode);
}

export function feCertificadosDir(companyCode: string) {
  return path.join(feCompanyRoot(companyCode), "certificados");
}

export function feXmlDir(companyCode: string, comprobanteId: string) {
  return path.join(feCompanyRoot(companyCode), "xml", comprobanteId);
}

export function fePdfDir(companyCode: string, comprobanteId: string) {
  return path.join(feCompanyRoot(companyCode), "pdf", comprobanteId);
}

export function feRecibidosDir(companyCode: string, recibidoId: string) {
  return path.join(feCompanyRoot(companyCode), "recibidos", recibidoId);
}

export function feLogosDir(companyCode: string) {
  return path.join(feCompanyRoot(companyCode), "logos");
}

/** Ruta relativa a FE_STORAGE_ROOT para persistir en BD. */
export function feRelativePath(...segments: string[]) {
  return path.join(...segments);
}

export async function ensureFeDir(absoluteDir: string) {
  await fs.mkdir(absoluteDir, { recursive: true });
}

export function feAbsolutePath(relativePath: string) {
  return path.join(FE_STORAGE_ROOT, relativePath);
}
