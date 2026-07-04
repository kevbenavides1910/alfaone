import { FE_IDENTIFICACION_CODIGO } from "../../constants/hacienda-catalogos";
import { FeDomainError } from "../../errors/fe-errors";
import { provinciaFromAdministracionTributaria } from "../../utils/fe-contribuyente-cliente-map";

const HACIENDA_AE_URL = "https://api.hacienda.go.cr/fe/ae";
const CACHE_TTL_MS = 60 * 60 * 1000;

type CacheEntry = { data: FeContribuyenteLookup; expiresAt: number };
const cache = new Map<string, CacheEntry>();

export type FeContribuyenteLookup = {
  identificacion: string;
  nombre: string;
  nombreComercial: string;
  tipoIdentificacion: keyof typeof FE_IDENTIFICACION_CODIGO;
  actividadEconomica: string | null;
  actividades: Array<{ codigo: string; descripcion: string; estado: string | null }>;
  regimen: { codigo: number | null; descripcion: string | null } | null;
  situacion: {
    moroso: string | null;
    omiso: string | null;
    estado: string | null;
    administracionTributaria: string | null;
  } | null;
  direccionProvincia: string | null;
};

type HaciendaAeResponse = {
  nombre?: string;
  tipoIdentificacion?: string;
  regimen?: { codigo?: number; descripcion?: string };
  situacion?: {
    moroso?: string;
    omiso?: string;
    estado?: string;
    administracionTributaria?: string;
  };
  actividades?: Array<{ estado?: string; codigo?: string; descripcion?: string }>;
};

const TIPO_FROM_HACIENDA: Record<string, FeContribuyenteLookup["tipoIdentificacion"]> = {
  "01": "FISICA",
  "02": "JURIDICA",
  "03": "DIMEX",
  "04": "NITE",
};

function inferTipoFromDigits(digits: string): FeContribuyenteLookup["tipoIdentificacion"] {
  if (digits.length === 9) return "FISICA";
  if (digits.length === 10) return "JURIDICA";
  if (digits.length >= 11) return "DIMEX";
  return "JURIDICA";
}

function pickActividad(actividades: HaciendaAeResponse["actividades"]): string | null {
  if (!actividades?.length) return null;
  const activa = actividades.find((a) => (a.estado ?? "").toUpperCase() === "A") ?? actividades[0];
  return activa?.codigo?.trim() || null;
}

export async function lookupContribuyenteHacienda(identificacion: string): Promise<FeContribuyenteLookup | null> {
  const digits = identificacion.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 12) {
    throw new FeDomainError("Identificación inválida para consulta", "FE_CONTRIBUYENTE_ID_INVALIDA", 400);
  }

  const cached = cache.get(digits);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const res = await fetch(`${HACIENDA_AE_URL}?identificacion=${encodeURIComponent(digits)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(12_000),
  });

  if (res.status === 404) return null;

  const text = await res.text();
  if (!res.ok) {
    if (res.status === 429) {
      throw new FeDomainError(
        "Hacienda limitó las consultas. Espere un momento e intente de nuevo.",
        "FE_CONTRIBUYENTE_RATE_LIMIT",
        429
      );
    }
    throw new FeDomainError(
      `No se pudo consultar contribuyente en Hacienda (${res.status})`,
      "FE_CONTRIBUYENTE_LOOKUP_ERROR",
      502
    );
  }

  let json: HaciendaAeResponse;
  try {
    json = JSON.parse(text) as HaciendaAeResponse;
  } catch {
    throw new FeDomainError("Respuesta inválida de Hacienda", "FE_CONTRIBUYENTE_LOOKUP_ERROR", 502);
  }

  const nombre = json.nombre?.trim();
  if (!nombre) return null;

  const tipoIdentificacion =
    TIPO_FROM_HACIENDA[json.tipoIdentificacion ?? ""] ?? inferTipoFromDigits(digits);

  const administracion = json.situacion?.administracionTributaria?.trim() || null;

  const data: FeContribuyenteLookup = {
    identificacion: digits,
    nombre: nombre.slice(0, 80),
    nombreComercial: nombre.slice(0, 200),
    tipoIdentificacion,
    actividadEconomica: pickActividad(json.actividades),
    actividades: (json.actividades ?? [])
      .map((a) => ({
        codigo: (a.codigo ?? "").trim(),
        descripcion: (a.descripcion ?? "").trim(),
        estado: a.estado ?? null,
      }))
      .filter((a) => a.codigo && a.descripcion),
    regimen: json.regimen
      ? {
          codigo: json.regimen.codigo ?? null,
          descripcion: json.regimen.descripcion?.trim() ?? null,
        }
      : null,
    situacion: json.situacion
      ? {
          moroso: json.situacion.moroso?.trim() ?? null,
          omiso: json.situacion.omiso?.trim() ?? null,
          estado: json.situacion.estado?.trim() ?? null,
          administracionTributaria: administracion,
        }
      : null,
    direccionProvincia: provinciaFromAdministracionTributaria(administracion),
  };

  cache.set(digits, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}
