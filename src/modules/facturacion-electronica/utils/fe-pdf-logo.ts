import { readFile } from "fs/promises";
import type { FeEmpresa } from "@prisma/client";
import { loadBrandingLogoFile } from "@/modules/disciplinario/services/disciplinary-pdf-logo";
import { feAbsolutePath } from "./fe-storage";

export async function loadFeEmpresaLogoFile(
  empresa: Pick<FeEmpresa, "logoPath">
): Promise<{ bytes: Uint8Array; path: string } | null> {
  const rel = empresa.logoPath?.trim();
  if (rel) {
    try {
      const buf = await readFile(feAbsolutePath(rel));
      return { bytes: new Uint8Array(buf), path: rel };
    } catch {
      /* fallback abajo */
    }
  }
  return loadBrandingLogoFile();
}
