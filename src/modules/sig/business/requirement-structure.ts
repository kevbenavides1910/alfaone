/**
 * Capítulos HLS (4…10) y «Generalidades» de relleno no se evalúan solos:
 * el cumplimiento vive en las cláusulas hijas / el padre con «debe».
 */
export function isChapterCode(code: string): boolean {
  return /^\d+$/.test(code.trim());
}

export function isBoilerplateGeneralidades(row: {
  title: string;
  description?: string | null;
  observations?: string | null;
}): boolean {
  if (!/generalidades/i.test(row.title)) return false;
  const desc = row.description?.trim() ?? "";
  const obs = row.observations ?? "";
  if (/Agregado al contrastar/i.test(obs)) return true;
  if (/^Demostrar\s+[«"']?Generalidades/i.test(desc)) return true;
  // Título solo «Generalidades» sin texto de cumplimiento propio → estructura
  if (/^generalidades$/i.test(row.title.trim()) && !desc) return true;
  return false;
}

export function isStructuralRequirement(row: {
  code: string;
  title: string;
  description?: string | null;
  observations?: string | null;
}): boolean {
  if (isChapterCode(row.code)) return true;
  return isBoilerplateGeneralidades(row);
}

export const STRUCTURAL_EXCLUSION_NOTE =
  "Apartado estructural (capítulo o generalidades): no se evalúa por separado; el cumplimiento se documenta en las cláusulas con requisitos «debe».";
