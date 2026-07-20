const TTL_MS = 5 * 60 * 1000;

type CacheEntry = {
  expiresAt: number;
  payload: unknown;
};

const store = new Map<string, CacheEntry>();

export function buildProfitabilityReportCacheKey(params: {
  month: string | null;
  companies: string[];
  partida: string;
  userCompany: string | null;
}): string {
  const companies = [...params.companies].sort();
  return JSON.stringify({
    month: params.month,
    companies,
    partida: params.partida,
    userCompany: params.userCompany,
  });
}

export function getProfitabilityReportCache<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return entry.payload as T;
}

export function setProfitabilityReportCache(key: string, payload: unknown): void {
  store.set(key, { expiresAt: Date.now() + TTL_MS, payload });
}

export function clearProfitabilityReportCache(): void {
  store.clear();
}
