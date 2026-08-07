import { normalizeLicitacionNo } from "@/modules/presupuestos/import/expense-rows";

export function normalizeRrhhContrato(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = normalizeLicitacionNo(raw.trim());
  if (!n || n === "-") return null;
  return n;
}

/** Puntaje 0–100 de similitud entre contrato NAF/RRHH y licitación del sistema. */
export function scoreContractMatch(rrhh: string, licitacion: string): number {
  const a = rrhh.toUpperCase().trim();
  const b = licitacion.toUpperCase().trim();
  if (a === b) return 100;

  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  // Misma base con sufijo corto distinto (…-A vs …-C): no es el mismo contrato.
  if (longer.startsWith(shorter) && /^-[A-Z0-9]{1,3}$/i.test(longer.slice(shorter.length))) {
    return 40;
  }
  if (a.includes(b) || b.includes(a)) return 85;

  let prefix = 0;
  const maxLen = Math.max(a.length, b.length);
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    prefix++;
  }
  if (prefix >= 8) {
    const restA = a.slice(prefix);
    const restB = b.slice(prefix);
    if (
      a[prefix - 1] === "-" &&
      /^[A-Z0-9]{1,3}$/i.test(restA) &&
      /^[A-Z0-9]{1,3}$/i.test(restB) &&
      restA !== restB
    ) {
      return 40;
    }
    return 60 + Math.min(20, (prefix / maxLen) * 20);
  }

  const tokensA = new Set(a.split(/[-/\s._]+/).filter((t) => t.length >= 3));
  const tokensB = new Set(b.split(/[-/\s._]+/).filter((t) => t.length >= 3));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let shared = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) shared++;
  }
  return Math.round((shared / Math.max(tokensA.size, tokensB.size)) * 55);
}

export type ContractCandidate = {
  contractId: string;
  licitacionNo: string;
  client: string;
  company: string;
  score: number;
};

export function rankContractCandidates(
  contratoRrhh: string,
  contracts: { id: string; licitacionNo: string; client: string; company: string }[],
  limit = 5,
): ContractCandidate[] {
  return contracts
    .map((c) => ({
      contractId: c.id,
      licitacionNo: c.licitacionNo,
      client: c.client,
      company: c.company,
      score: scoreContractMatch(contratoRrhh, c.licitacionNo),
    }))
    .filter((c) => c.score >= 25)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}
