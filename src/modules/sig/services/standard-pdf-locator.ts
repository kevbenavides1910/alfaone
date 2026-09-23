import { readFile } from "fs/promises";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { locateClausePage } from "../business/pdf-clause-locator";
import { SIG_DOCUMENTS_ROOT } from "./document-uploads";
import { prisma } from "@/modules/core/db/prisma";

type CacheEntry = {
  key: string;
  pages: string[];
  loadedAt: number;
};

const pageCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;

async function extractPdfPages(buffer: Buffer): Promise<string[]> {
  const pdfParse = (await import("pdf-parse")).default as (
    data: Buffer,
    opts?: { pagerender?: (pageData: { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }) => Promise<string> }
  ) => Promise<{ text: string; numpages: number }>;

  const pages: string[] = [];
  await pdfParse(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const text = textContent.items.map((i) => i.str).join(" ");
      pages.push(text);
      return text;
    },
  });
  return pages;
}

async function loadStandardPdfPages(standardId: string): Promise<string[] | null> {
  const row = await prisma.sigStandard.findUnique({
    where: { id: standardId },
    select: {
      id: true,
      pdfStoragePath: true,
      pdfSizeBytes: true,
      pdfUploadedAt: true,
    },
  });
  if (!row?.pdfStoragePath) return null;

  const cacheKey = `${row.id}:${row.pdfSizeBytes ?? 0}:${row.pdfUploadedAt?.getTime() ?? 0}`;
  const cached = pageCache.get(row.id);
  if (cached && cached.key === cacheKey && Date.now() - cached.loadedAt < CACHE_TTL_MS) {
    return cached.pages;
  }

  const abs = resolveUnderRoot(SIG_DOCUMENTS_ROOT, row.pdfStoragePath);
  if (!abs) return null;
  const buffer = await readFile(abs).catch(() => null);
  if (!buffer) return null;

  const pages = await extractPdfPages(buffer);
  pageCache.set(row.id, { key: cacheKey, pages, loadedAt: Date.now() });
  return pages;
}

export async function locateStandardClausePage(
  standardId: string,
  clauseCode: string,
  titleHint?: string | null
): Promise<{ page: number | null; pageCount: number }> {
  const pages = await loadStandardPdfPages(standardId);
  if (!pages?.length) return { page: null, pageCount: 0 };
  const page = locateClausePage(pages, clauseCode, titleHint);
  return { page, pageCount: pages.length };
}
