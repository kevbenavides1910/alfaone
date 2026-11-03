import type { FeIdentificacionTipo } from "@prisma/client";

const RANGES: Record<FeIdentificacionTipo, { min: number; max: number }> = {
  FISICA: { min: 9, max: 9 },
  JURIDICA: { min: 10, max: 10 },
  DIMEX: { min: 11, max: 12 },
  NITE: { min: 10, max: 10 },
  EXTRANJERO: { min: 9, max: 20 },
  NO_CONTRIBUYENTE: { min: 1, max: 20 },
};

/**
 * Cédula jurídica: 10 caracteres, pueden incluir letras (anexo 4.4, nov 2026).
 * El resto de tipos sigue siendo solo dígitos.
 * Sin tipo, se conservan letras si el valor ya las trae.
 */
export function normalizeIdentificacion(value: string, tipo?: string | null): string {
  const compact = (value ?? "").trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (tipo === "JURIDICA" || (tipo == null && /[A-Z]/.test(compact))) return compact;
  return compact.replace(/\D/g, "");
}

export function validateIdentificacion(tipo: FeIdentificacionTipo, value: string): string | null {
  const id = normalizeIdentificacion(value, tipo);
  const { min, max } = RANGES[tipo];
  const unidad = tipo === "JURIDICA" ? "caracteres" : "dígitos";
  if (id.length < min || id.length > max) {
    return `Identificación ${tipo.toLowerCase()} debe tener entre ${min} y ${max} ${unidad}.`;
  }
  if (tipo === "JURIDICA" && !/^[0-9A-Z]{10}$/.test(id)) {
    return "La cédula jurídica debe tener 10 caracteres, sin guiones.";
  }
  return null;
}
