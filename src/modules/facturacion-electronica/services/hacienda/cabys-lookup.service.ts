import { FeDomainError } from "../../errors/fe-errors";
import cabysRaiz from "../../data/cabys-categorias-raiz.json";

const HACIENDA_CABYS_URL = "https://api.hacienda.go.cr/fe/cabys";
const CACHE_TTL_MS = 30 * 60 * 1000;

export type FeCabysItem = {
  codigo: string;
  descripcion: string;
  impuesto: number | null;
  categorias: string[];
};

export type FeCabysBrowseCategory = {
  nombre: string;
};

export type FeCabysBrowseResult = {
  path: string[];
  categories: FeCabysBrowseCategory[];
  products: FeCabysItem[];
};

type CabysRaizEntry = { nombre: string; searchHints: string[] };
const CABYS_RAIZ = cabysRaiz as CabysRaizEntry[];

type CacheEntry = { data: FeCabysItem[]; expiresAt: number };
const cache = new Map<string, CacheEntry>();

function mapCabysItem(raw: {
  codigo?: string;
  descripcion?: string;
  impuesto?: number;
  categorias?: string[];
}): FeCabysItem | null {
  const codigo = raw.codigo?.replace(/\D/g, "") ?? "";
  if (codigo.length !== 13) return null;
  return {
    codigo,
    descripcion: (raw.descripcion ?? "").trim(),
    impuesto: typeof raw.impuesto === "number" ? raw.impuesto : null,
    categorias: raw.categorias ?? [],
  };
}

async function fetchCabys(url: string): Promise<FeCabysItem[]> {
  const cached = cache.get(url);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (res.status === 404) return [];

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) {
      throw new FeDomainError(
        "Hacienda limitó las consultas CABYS. Espere un momento.",
        "FE_CABYS_RATE_LIMIT",
        429
      );
    }
    throw new FeDomainError(`Error consultando CABYS (${res.status})`, "FE_CABYS_LOOKUP_ERROR", 502);
  }

  let json: { cabys?: unknown[] } | unknown[];
  try {
    json = JSON.parse(text) as { cabys?: unknown[] } | unknown[];
  } catch {
    throw new FeDomainError("Respuesta CABYS inválida", "FE_CABYS_LOOKUP_ERROR", 502);
  }

  const rows = Array.isArray(json) ? json : (json.cabys ?? []);
  const items = rows
    .map((row) => mapCabysItem(row as Parameters<typeof mapCabysItem>[0]))
    .filter((x): x is FeCabysItem => Boolean(x));

  cache.set(url, { data: items, expiresAt: Date.now() + CACHE_TTL_MS });
  return items;
}

export async function lookupCabysByCodigo(codigo: string): Promise<FeCabysItem | null> {
  const digits = codigo.replace(/\D/g, "");
  if (digits.length !== 13) {
    throw new FeDomainError("Código CABYS debe tener 13 dígitos", "FE_CABYS_ID_INVALIDO", 400);
  }
  const items = await fetchCabys(`${HACIENDA_CABYS_URL}?codigo=${encodeURIComponent(digits)}`);
  return items[0] ?? null;
}

export async function searchCabys(query: string, top = 15): Promise<FeCabysItem[]> {
  const q = query.trim();
  const digits = q.replace(/\D/g, "");

  if (digits.length === 13) {
    const one = await lookupCabysByCodigo(digits);
    return one ? [one] : [];
  }

  if (q.length < 3) {
    throw new FeDomainError("Ingrese al menos 3 caracteres para buscar CABYS", "FE_CABYS_Q_CORTA", 400);
  }

  const limit = Math.min(Math.max(top, 1), 25);
  return fetchCabys(
    `${HACIENDA_CABYS_URL}?q=${encodeURIComponent(q)}&top=${limit}`
  );
}

function normalizePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function pathMatches(categorias: string[], path: string[]) {
  if (categorias.length < path.length) return false;
  return path.every((segment, i) => normalizePathSegment(categorias[i] ?? "") === normalizePathSegment(segment));
}

function searchQueriesForPath(path: string[]): string[] {
  if (!path.length) return [];

  const rootEntry = CABYS_RAIZ.find((r) => r.nombre === path[0]);
  if (path.length === 1 && rootEntry) {
    return rootEntry.searchHints.filter((h) => h.length >= 3);
  }

  const last = path[path.length - 1] ?? "";
  const words = last
    .split(/[\s,;]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 4)
    .slice(0, 4);

  const queries = new Set<string>();
  if (words.length >= 2) queries.add(words.join(" "));
  for (const word of words) queries.add(word);
  if (last.length >= 3) queries.add(last.slice(0, 48));
  return [...queries].filter((q) => q.length >= 3).slice(0, 3);
}

export function listCabysRootCategories(): FeCabysBrowseCategory[] {
  return CABYS_RAIZ.map((r) => ({ nombre: r.nombre }));
}

export async function browseCabys(path: string[], top = 25): Promise<FeCabysBrowseResult> {
  if (!path.length) {
    return { path: [], categories: listCabysRootCategories(), products: [] };
  }

  const queries = searchQueriesForPath(path);
  if (!queries.length) {
    throw new FeDomainError("No se pudo determinar consulta para esta categoría", "FE_CABYS_BROWSE_ERROR", 400);
  }

  const merged = new Map<string, FeCabysItem>();
  for (const q of queries) {
    const items = await searchCabys(q, top);
    for (const item of items) merged.set(item.codigo, item);
  }

  const depth = path.length;
  const subcats = new Set<string>();
  const products: FeCabysItem[] = [];
  const seenProducts = new Set<string>();

  for (const item of merged.values()) {
    const cats = item.categorias;
    if (!pathMatches(cats, path)) continue;

    if (cats.length > depth) {
      subcats.add(cats[depth]!);
    }

    if (item.codigo.length !== 13 || seenProducts.has(item.codigo)) continue;

    const directChild = cats.length === depth + 1;
    const deepLeaf = depth >= 3;
    if (directChild || deepLeaf) {
      products.push(item);
      seenProducts.add(item.codigo);
    }
  }

  const categories = [...subcats]
    .sort((a, b) => a.localeCompare(b, "es"))
    .map((nombre) => ({ nombre }));

  const sortedProducts = products.sort((a, b) => a.descripcion.localeCompare(b.descripcion, "es"));

  return { path, categories, products: sortedProducts };
}
