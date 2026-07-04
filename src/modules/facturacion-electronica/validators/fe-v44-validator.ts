import type {
  FeCliente,
  FeEmpresa,
  FeFactura,
  FeFacturaCompra,
  FeFacturaCompraDetalle,
  FeFacturaDetalle,
  FeReciboPago,
  FeReciboPagoDetalle,
} from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { isActividadEnCatalogo, toTribuCodigo } from "../utils/hacienda-actividad";
import { validateIdentificacion } from "../utils/fe-identificacion";
import { calcularResumen, lineaTieneExoneracion, resolveMediosPago, resolveOtrosCargos } from "../utils/fe-resumen";
import { mapDetalleToLineaInput, resolveProveedorSistemas } from "../services/xml/fe-xml-shared";

function dec(value: { toString(): string } | number | string) {
  return Number(value.toString());
}

function receptorRequiereUbicacion(cliente: FeCliente): boolean {
  return cliente.tipoIdentificacion !== "EXTRANJERO";
}

function assertEmisorBasico(empresa: FeEmpresa, errors: string[]) {
  const tribu = toTribuCodigo(empresa.actividadEconomica);
  if (!tribu || !isActividadEnCatalogo(tribu)) {
    errors.push("Actividad económica del emisor inválida (catálogo TRIBU).");
  }

  const idEmisorErr = validateIdentificacion(empresa.tipoIdentificacion ?? "JURIDICA", empresa.cedulaJuridica);
  if (idEmisorErr) errors.push(`Emisor: ${idEmisorErr}`);

  const proveedor = resolveProveedorSistemas(empresa);
  if (!proveedor || proveedor.length < 9) {
    errors.push("Proveedor de sistemas inválido (configure cédula en emisor).");
  }
}

function validateMediosPagoFactura(params: {
  factura: {
    medioPago: FeFactura["medioPago"];
    medioPagoOtro?: string | null;
    mediosPago?: unknown;
    totalIvaDevuelto?: { toString(): string } | number | string | null;
  };
  totalComprobante: number;
  errors: string[];
}) {
  const { factura, totalComprobante, errors } = params;
  const medios = resolveMediosPago({
    medioPago: factura.medioPago,
    medioPagoOtro: factura.medioPagoOtro,
    mediosPago: factura.mediosPago,
    totalComprobante,
  });

  if (medios.length > 4) {
    errors.push("Hacienda permite como máximo 4 medios de pago.");
  }

  if (factura.medioPago === "OTROS" && !factura.medioPagoOtro?.trim() && medios.length <= 1) {
    errors.push("Indique el detalle del medio de pago «Otros» (mín. 3 caracteres).");
  }

  for (const mp of medios) {
    if (mp.tipo === "OTROS" && !(mp.otro?.trim() || factura.medioPagoOtro?.trim())) {
      errors.push("Indique el detalle del medio de pago «Otros» (mín. 3 caracteres).");
    }
  }

  if (dec(factura.totalIvaDevuelto ?? 0) > 0 && !medios.some((m) => m.tipo === "TARJETA")) {
    errors.push("IVA devuelto solo aplica con medio de pago Tarjeta.");
  }

  const sumMedios = medios.reduce((s, m) => s + m.total, 0);
  if (Math.abs(sumMedios - totalComprobante) > 0.02) {
    errors.push("La suma de medios de pago no coincide con el total del comprobante.");
  }
}

function validateOtrosCargosFactura(params: {
  factura: Pick<FeFactura, "otrosCargos" | "totalOtrosCargos">;
  resumenTotalOtrosCargos: number;
  errors: string[];
}) {
  const cargos = resolveOtrosCargos({
    otrosCargos: params.factura.otrosCargos,
    totalOtrosCargos: dec(params.factura.totalOtrosCargos),
  });
  if (cargos.length > 15) {
    params.errors.push("Hacienda permite como máximo 15 otros cargos.");
  }
  for (const [i, cargo] of cargos.entries()) {
    if (!/^\d{2}$/.test(cargo.tipoDocumento)) {
      params.errors.push(`Otro cargo ${i + 1}: tipo documento inválido.`);
    }
    if (cargo.detalle.length < 3) {
      params.errors.push(`Otro cargo ${i + 1}: detalle requerido (mín. 3 caracteres).`);
    }
  }
  if (cargos.length > 0 && Math.abs(params.resumenTotalOtrosCargos - dec(params.factura.totalOtrosCargos)) > 0.02) {
    params.errors.push("Total otros cargos no coincide con el detalle de cargos.");
  }
}

export function validateFeV44Factura(params: {
  empresa: FeEmpresa;
  cliente?: FeCliente | null;
  factura: FeFactura;
  detalles: FeFacturaDetalle[];
}) {
  const { empresa, cliente, factura, detalles } = params;
  const errors: string[] = [];
  const tipo = factura.tipoDocumento ?? "FACTURA_ELECTRONICA";
  const esTiquete = tipo === "TIQUETE_ELECTRONICO";
  const esExportacion = tipo === "FACTURA_ELECTRONICA_EXPORTACION";

  assertEmisorBasico(empresa, errors);

  if (cliente?.actividadEconomica?.trim()) {
    const tribu = toTribuCodigo(cliente.actividadEconomica);
    if (!tribu || !isActividadEnCatalogo(tribu)) {
      errors.push("Actividad económica del receptor inválida o no está en el catálogo TRIBU.");
    }
  }

  if (
    !esTiquete &&
    cliente &&
    empresa.exigirUbicacionReceptor &&
    receptorRequiereUbicacion(cliente)
  ) {
    if (!cliente.direccionProvincia?.trim()) errors.push("Receptor: provincia requerida.");
    if (!cliente.direccionCanton?.trim()) errors.push("Receptor: cantón requerido.");
    if (!cliente.direccionDistrito?.trim()) errors.push("Receptor: distrito requerido.");
  }

  if (factura.condicionVenta === "OTROS" && !factura.condicionVentaOtro?.trim()) {
    errors.push("Indique el detalle de condición de venta «Otros».");
  }

  if (factura.condicionVenta === "CREDITO" && !factura.plazoCredito) {
    errors.push("Indique el plazo de crédito en días.");
  }

  detalles.forEach((line, i) => {
    const cabys = (line.codigoCabys ?? "").replace(/\D/g, "");
    if (cabys.length !== 13) {
      errors.push(`Línea ${i + 1}: código CABYS obligatorio (13 dígitos).`);
    }
    const desc = dec(line.montoDescuento);
    if (desc > 0) {
      const nat = line.naturalezaDescuento?.trim();
      if (!nat || nat.length < 3) {
        errors.push(`Línea ${i + 1}: naturaleza del descuento requerida (3–80 caracteres).`);
      }
    }

    if (lineaTieneExoneracion(line)) {
      if (esExportacion) {
        errors.push(`Línea ${i + 1}: exoneraciones no permitidas en factura de exportación.`);
      }
      if (!line.exonNombreInstitucion?.trim()) {
        errors.push(`Línea ${i + 1}: exoneración requiere nombre de institución.`);
      }
      if (!line.exonFechaEmision) {
        errors.push(`Línea ${i + 1}: exoneración requiere fecha del documento.`);
      }
      const tdoc = line.exonTipoDocumento?.trim();
      if (!tdoc || !/^\d{2}$/.test(tdoc)) {
        errors.push(`Línea ${i + 1}: tipo documento exoneración debe ser 2 dígitos (nota 10.1).`);
      }
    }

    if (esExportacion) {
      const cabysD = (line.codigoCabys ?? "").replace(/\D/g, "");
      const esMercancia = cabysD.length > 0 && ["0", "1", "2", "3", "4"].includes(cabysD[0]!);
      if (esMercancia && !(line.partidaArancelaria ?? "").replace(/\D/g, "").match(/^\d{12}$/)) {
        errors.push(`Línea ${i + 1}: partida arancelaria obligatoria (12 dígitos) para mercancías exportadas.`);
      }
    }

    if (line.ivaCobradoFabrica?.trim() && !["01", "02"].includes(line.ivaCobradoFabrica.trim())) {
      errors.push(`Línea ${i + 1}: IVACobradoFabrica debe ser 01 o 02.`);
    }
  });

  const lineasInput = detalles.map(mapDetalleToLineaInput);

  const resumen = calcularResumen(lineasInput, {
    totalComprobanteOverride: dec(factura.total),
    totalOtrosCargos: dec(factura.totalOtrosCargos),
    otrosCargos: factura.otrosCargos,
    totalIvaDevuelto: dec(factura.totalIvaDevuelto),
  });

  validateMediosPagoFactura({ factura, totalComprobante: resumen.totalComprobante, errors });
  validateOtrosCargosFactura({ factura, resumenTotalOtrosCargos: resumen.totalOtrosCargos, errors });

  if (Math.abs(dec(factura.total) - resumen.totalComprobante) > 0.02) {
    errors.push("El total de la factura no coincide con el resumen calculado.");
  }

  if (Math.abs(dec(factura.totalImpuestos) - resumen.totalImpuesto) > 0.02) {
    errors.push("Total impuestos no coincide con el resumen calculado.");
  }

  if (errors.length > 0) {
    throw new FeDomainError(errors.join(" "), "FE_V44_VALIDATION", 400);
  }
}

export function validateFeV44FacturaCompra(params: {
  empresa: FeEmpresa;
  factura: FeFacturaCompra;
  detalles: FeFacturaCompraDetalle[];
}) {
  const { empresa, factura, detalles } = params;
  const errors: string[] = [];
  assertEmisorBasico(empresa, errors);

  if (!factura.proveedorNombre?.trim()) {
    errors.push("Nombre del proveedor extranjero requerido.");
  }
  if (!factura.proveedorIdentificacion?.trim()) {
    errors.push("Identificación del proveedor requerida.");
  }
  if (factura.proveedorTipoIdentificacion === "EXTRANJERO" && !factura.proveedorOtrasSenasExtranjero?.trim()) {
    errors.push("Otras señas extranjero requeridas para proveedor extranjero.");
  }

  detalles.forEach((line, i) => {
    const cabys = (line.codigoCabys ?? "").replace(/\D/g, "");
    if (cabys.length !== 13) {
      errors.push(`Línea ${i + 1}: código CABYS obligatorio (13 dígitos).`);
    }
  });

  const lineasInput = detalles.map((line) => ({
    cantidad: dec(line.cantidad),
    precioUnitario: dec(line.precioUnitario),
    montoDescuento: dec(line.montoDescuento),
    codigoCabys: line.codigoCabys,
    codigoTarifa: line.codigoImpuesto,
    tarifaImpuesto: dec(line.tarifaImpuesto),
    montoImpuesto: dec(line.montoImpuesto),
    totalLinea: dec(line.totalLinea),
  }));

  const resumen = calcularResumen(lineasInput, { totalComprobanteOverride: dec(factura.total) });

  if (Math.abs(dec(factura.total) - resumen.totalComprobante) > 0.02) {
    errors.push("El total de la factura de compra no coincide con el resumen calculado.");
  }
  if (Math.abs(dec(factura.totalImpuestos) - resumen.totalImpuesto) > 0.02) {
    errors.push("Total impuestos no coincide con el resumen calculado.");
  }

  if (errors.length > 0) {
    throw new FeDomainError(errors.join(" "), "FE_V44_VALIDATION", 400);
  }
}

const REP_CONDICIONES = new Set([
  "PAGO_SERVICIOS_ESTADO",
  "VENTA_CREDITO_IVA_90_DIAS",
  "PAGO_VENTA_PARCELADO",
  "PAGO_VENTA_CREDITO",
]);

export function validateFeV44ReciboPago(params: {
  empresa: FeEmpresa;
  recibo: FeReciboPago;
  detalles: FeReciboPagoDetalle[];
}) {
  const { empresa, recibo, detalles } = params;
  const errors: string[] = [];
  assertEmisorBasico(empresa, errors);

  if (!recibo.claveReferencia?.trim()) {
    errors.push("Clave del comprobante referenciado requerida.");
  }
  if (!REP_CONDICIONES.has(recibo.condicionVenta)) {
    errors.push("Condición de venta inválida para recibo electrónico de pago.");
  }
  if (!recibo.tipoDocReferencia?.trim() || !/^\d{2}$/.test(recibo.tipoDocReferencia)) {
    errors.push("Tipo de documento referenciado inválido.");
  }

  detalles.forEach((line, i) => {
    if (!line.descripcion?.trim()) {
      errors.push(`Línea ${i + 1}: descripción requerida.`);
    }
  });

  const totalImpuesto = detalles.reduce((s, d) => s + dec(d.montoImpuesto), 0);
  const totalCalc = dec(recibo.subtotal) + totalImpuesto;

  validateMediosPagoFactura({
    factura: recibo,
    totalComprobante: dec(recibo.total),
    errors,
  });

  if (Math.abs(dec(recibo.totalImpuestos) - totalImpuesto) > 0.02) {
    errors.push("Total impuestos no coincide con las líneas del recibo.");
  }
  if (Math.abs(dec(recibo.total) - totalCalc) > 0.02) {
    errors.push("El total del recibo no coincide con subtotal + impuestos.");
  }

  if (errors.length > 0) {
    throw new FeDomainError(errors.join(" "), "FE_V44_VALIDATION", 400);
  }
}
