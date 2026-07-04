import type { FeIdentificacionTipo } from "@prisma/client";

const RANGES: Record<FeIdentificacionTipo, { min: number; max: number }> = {
  FISICA: { min: 9, max: 9 },
  JURIDICA: { min: 10, max: 10 },
  DIMEX: { min: 11, max: 12 },
  NITE: { min: 10, max: 10 },
  EXTRANJERO: { min: 9, max: 20 },
  NO_CONTRIBUYENTE: { min: 1, max: 20 },
};

export function normalizeIdentificacion(value: string): string {
  return value.replace(/\D/g, "");
}

export function validateIdentificacion(tipo: FeIdentificacionTipo, value: string): string | null {
  const digits = normalizeIdentificacion(value);
  const { min, max } = RANGES[tipo];
  if (digits.length < min || digits.length > max) {
    return `Identificación ${tipo.toLowerCase()} debe tener entre ${min} y ${max} dígitos.`;
  }
  return null;
}
