/** Localiza la página de un apartado en el texto extraído de un PDF INTE/ISO. */

function isLikelyTocPage(text: string): boolean {
  const compact = text.replace(/\s+/g, " ");
  if (/CONTENIDO/i.test(compact) && (compact.match(/\.{4,}/g)?.length ?? 0) >= 3) return true;
  if ((compact.match(/\.{8,}/g)?.length ?? 0) >= 8) return true;
  return false;
}

function escapeClause(code: string): string {
  return code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleOverlap(a: string, b: string): number {
  const wa = new Set(normalizeTitle(a).split(" ").filter((w) => w.length > 3));
  const wb = new Set(normalizeTitle(b).split(" ").filter((w) => w.length > 3));
  if (wa.size === 0 || wb.size === 0) return 0;
  let n = 0;
  for (const w of wa) if (wb.has(w)) n += 1;
  return n / Math.min(wa.size, wb.size);
}

/**
 * Busca la 1.ª aparición de cuerpo (no índice) del código de cláusula.
 * `titleHint` (título del requisito) desempata cuando hay varias menciones.
 */
export function locateClausePage(
  pages: string[],
  clauseCode: string,
  titleHint?: string | null
): number | null {
  const code = clauseCode.trim();
  if (!/^\d+(?:\.\d+)*$/.test(code)) return null;

  const esc = escapeClause(code);
  // "4.1 Comprensión…" / "4.1.1 Generalidades" — no "4.1.2" ni "14.1"
  const headingRe = new RegExp(
    `(?:^|[^0-9.])(${esc})(?![0-9.])\\s*[—\\-–.]?\\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][^\\n]{2,120})`,
    "g"
  );

  type Hit = { page: number; score: number };
  const hits: Hit[] = [];

  for (let i = 0; i < pages.length; i++) {
    const raw = pages[i] ?? "";
    if (isLikelyTocPage(raw)) continue;
    const text = raw.replace(/\s+/g, " ");
    headingRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(text)) !== null) {
      const foundTitle = m[2] ?? "";
      let score = 10;
      if (i >= 5) score += 2;
      if (/\bdebe\b|\bdeber[aá]\b|\bshall\b/i.test(text.slice(Math.max(0, m.index - 20), m.index + 220))) {
        score += 4;
      }
      if (titleHint) {
        const overlap = titleOverlap(foundTitle, titleHint);
        score += Math.round(overlap * 12);
      }
      // Capítulos sueltos ("4 CONTEXTO") valen menos que "4.1 …"
      if (!code.includes(".") && foundTitle.length < 4) score -= 3;
      hits.push({ page: i + 1, score });
      break; // una vez por página
    }
  }

  if (hits.length === 0) return null;
  hits.sort((a, b) => b.score - a.score || a.page - b.page);
  return hits[0]?.page ?? null;
}

/** Índice de la 1.ª aparición en cuerpo de cada código `d` / `d.d`… */
export function buildClausePageIndex(pages: string[]): Record<string, number> {
  const index: Record<string, number> = {};
  const headingRe =
    /(?:^|[^0-9.])(\d+(?:\.\d+)*)(?![0-9.])\s*[—\-–.]?\s*([A-Za-zÁÉÍÓÚÜÑáéíóúüñ][^\n]{2,120})/g;

  for (let i = 0; i < pages.length; i++) {
    const raw = pages[i] ?? "";
    if (isLikelyTocPage(raw)) continue;
    const text = raw.replace(/\s+/g, " ");
    headingRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = headingRe.exec(text)) !== null) {
      const code = m[1];
      if (!code || index[code] != null) continue;
      // Evitar falsos positivos tipo años 2015, ICS 03.120.10 sueltos en pies
      if (/^(19|20)\d{2}$/.test(code)) continue;
      if (Number(code) > 20 && !code.includes(".")) continue;
      index[code] = i + 1;
    }
  }
  return index;
}
