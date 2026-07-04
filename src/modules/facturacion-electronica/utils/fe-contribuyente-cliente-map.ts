import type { FeContribuyenteLookup } from "../services/hacienda/contribuyente-lookup.service";
import { padUbicacionCode } from "../catalogos/cr-ubicacion";

export type NuevoClienteForm = {
  tipoIdentificacion: string;
  identificacion: string;
  nombre: string;
  email: string;
  telefono: string;
  direccionProvincia: string;
  direccionCanton: string;
  direccionDistrito: string;
  direccionBarrio: string;
  direccionOtras: string;
  actividadEconomica: string;
};

const PROVINCIA_FROM_ADMIN: Record<string, string> = {
  "san jose": "1",
  "san josé": "1",
  alajuela: "2",
  cartago: "3",
  heredia: "4",
  guanacaste: "5",
  puntarenas: "6",
  limon: "7",
  limón: "7",
};

export function provinciaFromAdministracionTributaria(admin?: string | null): string | null {
  if (!admin?.trim()) return null;
  const key = admin
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return PROVINCIA_FROM_ADMIN[key] ?? null;
}

export function buildSituacionNotas(data: Pick<FeContribuyenteLookup, "regimen" | "situacion">): string {
  const parts: string[] = [];
  if (data.situacion?.estado) parts.push(`Estado: ${data.situacion.estado}`);
  if (data.regimen?.descripcion) parts.push(`Régimen: ${data.regimen.descripcion}`);
  if (data.situacion?.moroso) parts.push(`Moroso: ${data.situacion.moroso}`);
  if (data.situacion?.omiso) parts.push(`Omiso: ${data.situacion.omiso}`);
  if (data.situacion?.administracionTributaria) {
    parts.push(`Administración: ${data.situacion.administracionTributaria}`);
  }
  return parts.join(" | ");
}

export function actividadDescripcion(
  actividades: FeContribuyenteLookup["actividades"],
  codigo: string | null | undefined
) {
  if (!codigo) return "";
  const match = actividades.find((a) => a.codigo === codigo);
  return match?.descripcion ?? "";
}

/** Campos que Hacienda no publica: email, teléfono, cantón, distrito, barrio. */
export function mapContribuyenteToClienteForm(
  data: FeContribuyenteLookup,
  prev: NuevoClienteForm
): NuevoClienteForm {
  const provincia = data.direccionProvincia ?? provinciaFromAdministracionTributaria(data.situacion?.administracionTributaria);
  const notas = buildSituacionNotas(data);

  return {
    ...prev,
    tipoIdentificacion: data.tipoIdentificacion,
    identificacion: data.identificacion,
    nombre: data.nombre,
    actividadEconomica: data.actividadEconomica ?? prev.actividadEconomica,
    direccionProvincia: provincia ?? prev.direccionProvincia,
    direccionOtras: prev.direccionOtras.trim() || notas || prev.direccionOtras,
    email: prev.email,
    telefono: prev.telefono,
    direccionCanton: prev.direccionCanton,
    direccionDistrito: prev.direccionDistrito,
    direccionBarrio: prev.direccionBarrio,
  };
}

export function mapDbClienteToForm(cliente: {
  tipoIdentificacion: string;
  identificacion: string;
  nombre: string;
  email?: string | null;
  telefono?: string | null;
  actividadEconomica?: string | null;
  direccionProvincia?: string | null;
  direccionCanton?: string | null;
  direccionDistrito?: string | null;
  direccionBarrio?: string | null;
  direccionOtras?: string | null;
}): NuevoClienteForm {
  return {
    tipoIdentificacion: cliente.tipoIdentificacion,
    identificacion: cliente.identificacion,
    nombre: cliente.nombre,
    email: cliente.email ?? "",
    telefono: cliente.telefono ?? "",
    actividadEconomica: cliente.actividadEconomica ?? "",
    direccionProvincia: cliente.direccionProvincia ?? "",
    direccionCanton: padUbicacionCode(cliente.direccionCanton),
    direccionDistrito: padUbicacionCode(cliente.direccionDistrito),
    direccionBarrio: cliente.direccionBarrio ?? "",
    direccionOtras: cliente.direccionOtras ?? "",
  };
}
