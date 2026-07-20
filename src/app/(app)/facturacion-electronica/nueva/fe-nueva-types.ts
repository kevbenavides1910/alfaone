import { isTarifaIvaSinMonto, codigoTarifaToPercent } from "@/modules/facturacion-electronica/utils/fe-tarifa-iva";
import { isUbicacionSelectionValid } from "@/modules/facturacion-electronica/catalogos/cr-ubicacion";
import { toTribuCodigo, isActividadEnCatalogo } from "@/modules/facturacion-electronica/utils/hacienda-actividad";

export type FeConfigResponse = {
  configured: boolean;
  empresa?: { exigirUbicacionReceptor?: boolean } | null;
  sucursales: Array<{
    id: string;
    codigo: string;
    nombre: string;
    puntosVenta: Array<{ id: string; codigo: string; nombre: string }>;
  }>;
};

export type FeCliente = {
  id: string;
  nombre: string;
  identificacion: string;
  tipoIdentificacion: string;
  email?: string | null;
  telefono?: string | null;
  actividadEconomica?: string | null;
  direccionProvincia?: string | null;
  direccionCanton?: string | null;
  direccionDistrito?: string | null;
  direccionBarrio?: string | null;
  direccionOtras?: string | null;
};

export type LineaForm = {
  key: string;
  codigoCabys: string;
  descripcion: string;
  cantidad: string;
  unidadMedida: string;
  precioUnitario: string;
  montoDescuento: string;
  naturalezaDescuento: string;
  codigoTarifaIVA: string;
  tarifaImpuesto: string;
  exonActiva: boolean;
  exonTipoDocumento: string;
  exonNumeroDocumento: string;
  exonNombreInstitucion: string;
  exonFechaEmision: string;
  exonPorcentaje: string;
  exonMonto: string;
  ivaCobradoFabrica: string;
  impuestoAsumidoFabrica: string;
  partidaArancelaria: string;
  montoImpuestoExportacion: string;
  cabysDescripcion: string;
};

export type MedioPagoRow = {
  key: string;
  tipo: string;
  total: string;
  otro: string;
};

export type OtroCargoRow = {
  key: string;
  tipoDocumento: string;
  detalle: string;
  montoCargo: string;
};

export const emptyMedioPago = (): MedioPagoRow => ({
  key: crypto.randomUUID(),
  tipo: "TRANSFERENCIA_DEPOSITO",
  total: "",
  otro: "",
});

export const emptyOtroCargo = (): OtroCargoRow => ({
  key: crypto.randomUUID(),
  tipoDocumento: "99",
  detalle: "",
  montoCargo: "",
});

export const emptyLine = (): LineaForm => ({
  key: crypto.randomUUID(),
  codigoCabys: "",
  descripcion: "",
  cantidad: "1",
  unidadMedida: "Unid",
  precioUnitario: "0",
  montoDescuento: "0",
  naturalezaDescuento: "",
  codigoTarifaIVA: "08",
  tarifaImpuesto: "13",
  exonActiva: false,
  exonTipoDocumento: "02",
  exonNumeroDocumento: "",
  exonNombreInstitucion: "",
  exonFechaEmision: "",
  exonPorcentaje: "",
  exonMonto: "",
  ivaCobradoFabrica: "",
  impuestoAsumidoFabrica: "0",
  partidaArancelaria: "",
  montoImpuestoExportacion: "",
  cabysDescripcion: "",
});

// === Validaciones según reglas de Hacienda (Resolución 48-2016, v4.4) ===

export const ID_RANGES: Record<string, { min: number; max: number; label: string }> = {
  FISICA: { min: 9, max: 9, label: "Cédula física — 9 dígitos (ej. 001120580)" },
  JURIDICA: { min: 10, max: 10, label: "Cédula jurídica — 10 dígitos (ej. 3101598499)" },
  DIMEX: { min: 11, max: 12, label: "DIMEX — 11 o 12 dígitos" },
  NITE: { min: 10, max: 10, label: "NITE — 10 dígitos" },
  EXTRANJERO: { min: 9, max: 20, label: "Identificación extranjera — 9 a 20 dígitos" },
};

export function validateId(tipo: string, value: string): string | null {
  const digits = (value || "").replace(/\D/g, "");
  const range = ID_RANGES[tipo];
  if (!range) return null;
  if (!digits) return "Identificación requerida";
  if (digits.length < range.min || digits.length > range.max) {
    return `Debe tener ${range.min === range.max ? range.min : `${range.min}-${range.max}`} dígitos (actual: ${digits.length})`;
  }
  return null;
}

export function validateCABYS(value: string): string | null {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "CABYS requerido";
  if (digits.length !== 13) return `Debe tener 13 dígitos (actual: ${digits.length})`;
  return null;
}

export function validateEmail(value: string): string | null {
  if (!value?.trim()) return null; // opcional
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return "Formato de correo inválido";
  return null;
}

export function validateActividadEconomica(value: string): string | null {
  if (!value?.trim()) return null;
  const tribu = toTribuCodigo(value);
  if (!tribu || !isActividadEnCatalogo(tribu)) {
    return "Seleccione una actividad del catálogo TRIBU (ej. 8010.0). Prefiera las registradas en Hacienda.";
  }
  return null;
}

export function validateCliente(
  cliente: typeof nuevoClienteDefault,
  opts?: { exigirUbicacion?: boolean; esTiquete?: boolean }
): string[] {
  const errs: string[] = [];
  const idErr = validateId(cliente.tipoIdentificacion, cliente.identificacion);
  if (idErr) errs.push(`Identificación: ${idErr}`);
  if (!cliente.nombre.trim()) errs.push("Nombre del cliente es obligatorio");
  if (cliente.nombre.length > 80) errs.push("Nombre: máximo 80 caracteres");
  const emailErr = validateEmail(cliente.email);
  if (emailErr) errs.push(emailErr);
  const actErr = validateActividadEconomica(cliente.actividadEconomica);
  if (actErr) errs.push(`Actividad económica: ${actErr}`);
  if (
    opts?.exigirUbicacion &&
    !opts.esTiquete &&
    cliente.tipoIdentificacion !== "EXTRANJERO"
  ) {
    if (!cliente.direccionProvincia.trim()) errs.push("Provincia del cliente requerida");
    if (!cliente.direccionCanton.trim()) errs.push("Cantón del cliente requerido");
    if (!cliente.direccionDistrito.trim()) errs.push("Distrito del cliente requerido");
    else if (
      !isUbicacionSelectionValid(
        cliente.direccionProvincia,
        cliente.direccionCanton,
        cliente.direccionDistrito
      )
    ) {
      errs.push("Ubicación del cliente inválida (provincia, cantón o distrito no coinciden)");
    }
  }
  return errs;
}

export const nuevoClienteDefault = {
  tipoIdentificacion: "JURIDICA",
  identificacion: "",
  nombre: "",
  email: "",
  telefono: "",
  direccionProvincia: "",
  direccionCanton: "",
  direccionDistrito: "",
  direccionBarrio: "",
  direccionOtras: "",
  actividadEconomica: "",
};

export function lineTotals(line: LineaForm) {
  const cantidad = Number(line.cantidad) || 0;
  const precio = Number(line.precioUnitario) || 0;
  const descuento = Number(line.montoDescuento) || 0;
  const codigoTarifa = line.codigoTarifaIVA || "08";
  const tarifa = isTarifaIvaSinMonto(codigoTarifa)
    ? 0
    : Number(line.tarifaImpuesto) || codigoTarifaToPercent(codigoTarifa);
  const base = Math.max(0, cantidad * precio - descuento);
  const montoImpuestoBruto = isTarifaIvaSinMonto(codigoTarifa)
    ? 0
    : Math.round(base * (tarifa / 100) * 100000) / 100000;
  let exonMonto = Number(line.exonMonto) || 0;
  if (line.exonActiva && exonMonto <= 0) {
    const pct = Number(line.exonPorcentaje) || 0;
    if (pct > 0) exonMonto = Math.round(base * (pct / 100) * 100000) / 100000;
  }
  const impuestoAsumido = Number(line.impuestoAsumidoFabrica) || 0;
  const montoImpuesto = Math.max(0, montoImpuestoBruto - exonMonto - impuestoAsumido);
  const totalLinea = Math.round((base + montoImpuesto) * 100000) / 100000;
  return { base, montoImpuestoBruto, montoImpuesto, exonMonto, totalLinea };
}
