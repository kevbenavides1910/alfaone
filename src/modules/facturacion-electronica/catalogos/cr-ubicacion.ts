import provinciasData from "./data/adm1-provincias.json";
import cantonesData from "./data/adm2-cantones.json";
import distritosData from "./data/adm3-distritos.json";

export type UbicacionItem = { code: string; name: string };

type ProvinciaRow = { Nombre: string };
type CantonRow = { Provincia: string; Nombre: string };
type DistritoRow = { Cantón: string; Nombre: string };

const provincias = provinciasData as Record<string, ProvinciaRow>;
const cantones = cantonesData as Record<string, CantonRow>;
const distritos = distritosData as Record<string, DistritoRow>;

export const PROVINCIAS_CR: UbicacionItem[] = Object.entries(provincias)
  .map(([code, row]) => ({ code, name: row.Nombre }))
  .sort((a, b) => a.code.localeCompare(b.code));

/** Código de cantón/distrito a 2 dígitos (formato Hacienda). */
export function padUbicacionCode(value: string | null | undefined): string {
  const digits = (value ?? "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.slice(-2).padStart(2, "0");
}

export function cantonFullCode(provinciaCode: string, cantonCode: string): string {
  return `${provinciaCode}${padUbicacionCode(cantonCode)}`;
}

export function listCantones(provinciaCode: string): UbicacionItem[] {
  if (!provinciaCode) return [];
  return Object.entries(cantones)
    .filter(([, row]) => row.Provincia === provinciaCode)
    .map(([fullCode, row]) => ({
      code: fullCode.slice(-2),
      name: row.Nombre,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function listDistritos(provinciaCode: string, cantonCode: string): UbicacionItem[] {
  if (!provinciaCode || !cantonCode) return [];
  const cantonKey = cantonFullCode(provinciaCode, cantonCode);
  return Object.entries(distritos)
    .filter(([, row]) => row.Cantón === cantonKey)
    .map(([fullCode, row]) => ({
      code: fullCode.slice(-2),
      name: row.Nombre,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

export function findCantonName(provinciaCode: string, cantonCode: string): string | undefined {
  return listCantones(provinciaCode).find((c) => c.code === padUbicacionCode(cantonCode))?.name;
}

export function findDistritoName(
  provinciaCode: string,
  cantonCode: string,
  distritoCode: string
): string | undefined {
  return listDistritos(provinciaCode, cantonCode).find((d) => d.code === padUbicacionCode(distritoCode))?.name;
}

export function isUbicacionSelectionValid(
  provinciaCode: string,
  cantonCode: string,
  distritoCode: string
): boolean {
  if (!provinciaCode.trim() || !cantonCode.trim() || !distritoCode.trim()) return false;
  const canton = padUbicacionCode(cantonCode);
  const distrito = padUbicacionCode(distritoCode);
  return Boolean(findCantonName(provinciaCode, canton) && findDistritoName(provinciaCode, canton, distrito));
}
