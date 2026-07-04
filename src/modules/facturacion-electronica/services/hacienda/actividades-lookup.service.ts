import actividadesCatalog from "../../data/actividades-ciiu4-cr.json";
import { FeEmpresaRepository } from "../../repositories/fe-empresa.repository";
import { prisma } from "@/modules/core/db/prisma";
import { FeDomainError } from "../../errors/fe-errors";

const HACIENDA_AE_URL = "https://api.hacienda.go.cr/fe/ae";
const CACHE_TTL_MS = 60 * 60 * 1000;

export type FeActividadItem = {
  codigo: string;
  descripcion: string;
  origen: "contribuyente" | "catalogo";
  estado?: string | null;
};

type AeActividad = { estado?: string; codigo?: string; descripcion?: string };
type CacheEntry = { data: FeActividadItem[]; expiresAt: number };
const contribuyenteCache = new Map<string, CacheEntry>();

const catalogo: FeActividadItem[] = (actividadesCatalog as Array<{ codigo: string; descripcion: string }>).map(
  (a) => ({
    codigo: a.codigo,
    descripcion: a.descripcion,
    origen: "catalogo" as const,
  })
);

async function fetchActividadesContribuyente(identificacion: string): Promise<FeActividadItem[]> {
  const digits = identificacion.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 12) return [];

  const cached = contribuyenteCache.get(digits);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const res = await fetch(`${HACIENDA_AE_URL}?identificacion=${encodeURIComponent(digits)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (res.status === 404) {
    contribuyenteCache.set(digits, { data: [], expiresAt: Date.now() + CACHE_TTL_MS });
    return [];
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new FeDomainError(
        "Hacienda limitó las consultas. Espere un momento.",
        "FE_ACTIVIDAD_RATE_LIMIT",
        429
      );
    }
    throw new FeDomainError(
      `Error consultando actividades (${res.status})`,
      "FE_ACTIVIDAD_LOOKUP_ERROR",
      502
    );
  }

  const json = (await res.json()) as { actividades?: AeActividad[] };
  const items = (json.actividades ?? [])
    .map((a) => ({
      codigo: (a.codigo ?? "").trim(),
      descripcion: (a.descripcion ?? "").trim(),
      origen: "contribuyente" as const,
      estado: a.estado ?? null,
    }))
    .filter((a) => a.codigo && a.descripcion);

  contribuyenteCache.set(digits, { data: items, expiresAt: Date.now() + CACHE_TTL_MS });
  return items;
}

function normalizeQ(q: string) {
  return q
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function matchesActividad(item: FeActividadItem, qNorm: string, qRaw: string) {
  const codeNorm = item.codigo.replace(/\s/g, "").toLowerCase();
  const codeDigits = item.codigo.replace(/\D/g, "");
  const qDigits = qRaw.replace(/\D/g, "");
  const descNorm = normalizeQ(item.descripcion);
  return (
    codeNorm.includes(qNorm) ||
    descNorm.includes(qNorm) ||
    (qDigits.length >= 3 && codeDigits.includes(qDigits))
  );
}

function dedupeActividades(items: FeActividadItem[]) {
  const map = new Map<string, FeActividadItem>();
  for (const item of items) {
    const key = item.codigo.replace(/\s/g, "");
    const prev = map.get(key);
    if (!prev || item.origen === "contribuyente") map.set(key, item);
  }
  return [...map.values()];
}

export async function searchActividadesEconomicas(params: {
  q: string;
  companyCode: string;
  identificacion?: string | null;
  top?: number;
}): Promise<FeActividadItem[]> {
  const q = params.q.trim();
  if (q.length < 2) {
    throw new FeDomainError("Ingrese al menos 2 caracteres para buscar actividad", "FE_ACTIVIDAD_Q_CORTA", 400);
  }

  const limit = Math.min(Math.max(params.top ?? 20, 1), 40);
  const qNorm = normalizeQ(q);
  const merged: FeActividadItem[] = [];

  const empresaRepo = new FeEmpresaRepository(prisma);
  const empresa = await empresaRepo.findOptionalByCompanyCode(params.companyCode);
  if (empresa?.cedulaJuridica) {
    merged.push(...(await fetchActividadesContribuyente(empresa.cedulaJuridica)));
  }

  const idCliente = params.identificacion?.replace(/\D/g, "") ?? "";
  if (idCliente.length >= 9) {
    merged.push(...(await fetchActividadesContribuyente(idCliente)));
  }

  merged.push(...catalogo);

  const filtered = dedupeActividades(merged)
    .filter((item) => matchesActividad(item, qNorm, q))
    .sort((a, b) => {
      if (a.origen !== b.origen) return a.origen === "contribuyente" ? -1 : 1;
      return a.codigo.localeCompare(b.codigo);
    });

  return filtered.slice(0, limit);
}

export async function listActividadesContribuyente(identificacion: string) {
  return fetchActividadesContribuyente(identificacion);
}
