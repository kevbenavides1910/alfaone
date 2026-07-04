import type { FeCliente, FeEmpresa, FeFacturaDetalle } from "@prisma/client";
import { create } from "xmlbuilder2";
import {
  FE_CONDICION_VENTA_CODIGO,
  FE_IDENTIFICACION_CODIGO,
  FE_MONEDA_CODIGO,
} from "../../constants/hacienda-catalogos";
import type { FeCondicionVenta, FeMoneda } from "@prisma/client";
import { actividadForXml } from "../../utils/hacienda-actividad";
import {
  fmtDecimal,
  medioPagoCodigo,
  type FeLineaCalculada,
  type FeMedioPagoLinea,
  type FeOtroCargoLinea,
  type FeResumenCalculado,
} from "../../utils/fe-resumen";

type XmlNode = ReturnType<typeof create>;

export function normalizeUbicacionCodigo(value: string | null | undefined, width: number) {
  const digits = (value ?? "").replace(/\D/g, "");
  if (digits.length >= width) return digits.slice(0, width).padStart(width, "0");
  return "1".padStart(width, "0");
}

export function appendUbicacion(
  parent: XmlNode,
  data: {
    provincia?: string | null;
    canton?: string | null;
    distrito?: string | null;
    barrio?: string | null;
    otras?: string | null;
  }
) {
  const u = parent.ele("Ubicacion");
  u.ele("Provincia").txt(normalizeUbicacionCodigo(data.provincia, 1));
  u.ele("Canton").txt(normalizeUbicacionCodigo(data.canton, 2));
  u.ele("Distrito").txt(normalizeUbicacionCodigo(data.distrito, 2));
  if (data.barrio?.trim()) u.ele("Barrio").txt(data.barrio.trim().slice(0, 50));
  const otrasSenas = data.otras?.trim() || data.barrio?.trim() || "No indicado";
  u.ele("OtrasSenas").txt(otrasSenas.slice(0, 250));
}

export function appendEncabezadoActividad(params: {
  root: XmlNode;
  empresa: FeEmpresa;
  cliente?: FeCliente | null;
  proveedorSistemas: string;
}) {
  params.root.ele("ProveedorSistemas").txt(params.proveedorSistemas.replace(/\D/g, "").slice(0, 20));
  params.root.ele("CodigoActividadEmisor").txt(actividadForXml(params.empresa.actividadEconomica));

  const actReceptor = actividadForXml(params.cliente?.actividadEconomica);
  if (params.cliente?.actividadEconomica?.trim() && actReceptor !== "000000") {
    params.root.ele("CodigoActividadReceptor").txt(actReceptor);
  }
}

export function appendEmisorReceptor(params: {
  root: XmlNode;
  empresa: FeEmpresa;
  cliente?: FeCliente | null;
  incluirReceptor?: boolean;
}) {
  const { root, empresa, cliente } = params;
  const incluirReceptor = params.incluirReceptor ?? Boolean(cliente);
  const tipoEmisor = FE_IDENTIFICACION_CODIGO[empresa.tipoIdentificacion ?? "JURIDICA"];

  const emisor = root.ele("Emisor");
  emisor.ele("Nombre").txt(empresa.razonSocial.slice(0, 100));
  emisor
    .ele("Identificacion")
    .ele("Tipo")
    .txt(tipoEmisor)
    .up()
    .ele("Numero")
    .txt(empresa.cedulaJuridica.replace(/\D/g, "").slice(0, 20));
  if (empresa.nombreComercial) {
    emisor.ele("NombreComercial").txt(empresa.nombreComercial.slice(0, 80));
  }
  appendUbicacion(emisor, {
    provincia: empresa.direccionProvincia,
    canton: empresa.direccionCanton,
    distrito: empresa.direccionDistrito,
    barrio: empresa.direccionBarrio,
    otras: empresa.direccionOtras,
  });
  if (empresa.telefono) {
    emisor
      .ele("Telefono")
      .ele("CodigoPais")
      .txt("506")
      .up()
      .ele("NumTelefono")
      .txt(empresa.telefono.replace(/\D/g, "").slice(-20));
  }
  if (empresa.email) emisor.ele("CorreoElectronico").txt(empresa.email);

  if (!incluirReceptor || !cliente) return;

  const receptor = root.ele("Receptor");
  receptor.ele("Nombre").txt(cliente.nombre.slice(0, 100));
  receptor
    .ele("Identificacion")
    .ele("Tipo")
    .txt(FE_IDENTIFICACION_CODIGO[cliente.tipoIdentificacion])
    .up()
    .ele("Numero")
    .txt(cliente.identificacion.replace(/\D/g, ""));
  appendUbicacion(receptor, {
    provincia: cliente.direccionProvincia,
    canton: cliente.direccionCanton,
    distrito: cliente.direccionDistrito,
    barrio: cliente.direccionBarrio,
    otras: cliente.direccionOtras,
  });
  if (cliente.email) receptor.ele("CorreoElectronico").txt(cliente.email);
}

export function appendEmisorReceptorCompra(params: {
  root: XmlNode;
  empresa: FeEmpresa;
  proveedor: {
    tipoIdentificacion: keyof typeof FE_IDENTIFICACION_CODIGO;
    identificacion: string;
    nombre: string;
    otrasSenasExtranjero?: string | null;
  };
}) {
  const { root, empresa, proveedor } = params;

  const emisor = root.ele("Emisor");
  emisor.ele("Nombre").txt(proveedor.nombre.slice(0, 100));
  emisor
    .ele("Identificacion")
    .ele("Tipo")
    .txt(FE_IDENTIFICACION_CODIGO[proveedor.tipoIdentificacion])
    .up()
    .ele("Numero")
    .txt(proveedor.identificacion.replace(/\D/g, "").slice(0, 20));
  if (proveedor.otrasSenasExtranjero?.trim()) {
    emisor.ele("OtrasSenasExtranjero").txt(proveedor.otrasSenasExtranjero.trim().slice(0, 300));
  }

  const tipoReceptor = FE_IDENTIFICACION_CODIGO[empresa.tipoIdentificacion ?? "JURIDICA"];
  const receptor = root.ele("Receptor");
  receptor.ele("Nombre").txt(empresa.razonSocial.slice(0, 100));
  receptor
    .ele("Identificacion")
    .ele("Tipo")
    .txt(tipoReceptor)
    .up()
    .ele("Numero")
    .txt(empresa.cedulaJuridica.replace(/\D/g, "").slice(0, 20));
  appendUbicacion(receptor, {
    provincia: empresa.direccionProvincia,
    canton: empresa.direccionCanton,
    distrito: empresa.direccionDistrito,
    barrio: empresa.direccionBarrio,
    otras: empresa.direccionOtras,
  });
  if (empresa.email) receptor.ele("CorreoElectronico").txt(empresa.email);
}

export function appendInformacionReferencia(params: {
  root: XmlNode;
  tipoDoc: string;
  numero: string;
  fechaEmision: string;
  codigo: string;
  razon?: string | null;
  tipoDocOtro?: string | null;
  codigoReferenciaOtro?: string | null;
}) {
  const info = params.root.ele("InformacionReferencia");
  const tipoDoc = params.tipoDoc.slice(0, 2);
  info.ele("TipoDocIR").txt(tipoDoc);
  if (tipoDoc === "99" && params.tipoDocOtro?.trim()) {
    info.ele("TipoDocRefOTRO").txt(params.tipoDocOtro.trim().slice(0, 100));
  }
  info.ele("Numero").txt(params.numero.slice(0, 50));
  info.ele("FechaEmisionIR").txt(params.fechaEmision);
  const codigo = params.codigo.slice(0, 2);
  info.ele("Codigo").txt(codigo);
  if (codigo === "99" && params.codigoReferenciaOtro?.trim()) {
    info.ele("CodigoReferenciaOTRO").txt(params.codigoReferenciaOtro.trim().slice(0, 100));
  }
  if (params.razon?.trim()) info.ele("Razon").txt(params.razon.trim().slice(0, 180));
}

export type FeLineaExoneracionXml = {
  exonTipoDocumento?: string | null;
  exonNumeroDocumento?: string | null;
  exonNombreInstitucion?: string | null;
  exonFechaEmision?: Date | null;
  exonPorcentaje?: { toString(): string } | number | null;
  exonMontoCalculado: number;
};

export type FeLineaXmlInput = {
  numeroLinea: number;
  codigoCabys?: string | null;
  codigo?: string | null;
  descripcion: string;
  unidadMedida: string;
  montoDescuento: number;
  codigoDescuento?: string | null;
  naturalezaDescuento?: string | null;
  calculada: FeLineaCalculada;
  montoImpuesto: number;
  totalLinea: number;
  tarifaImpuesto: number;
  exoneracion?: FeLineaExoneracionXml | null;
  ivaCobradoFabrica?: string | null;
  partidaArancelaria?: string | null;
  montoImpuestoExportacion?: number | null;
  permitirExoneracion?: boolean;
};

function formatExonFecha(fecha: Date | null | undefined): string {
  if (!fecha) return "";
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function appendDetalleServicio(root: XmlNode, lineas: FeLineaXmlInput[]) {
  const detalleServicio = root.ele("DetalleServicio");
  for (const line of lineas) {
    const c = line.calculada;
    const ld = detalleServicio.ele("LineaDetalle");
    ld.ele("NumeroLinea").txt(String(line.numeroLinea));
    ld.ele("CodigoCABYS").txt((line.codigoCabys ?? "").replace(/\D/g, "").padStart(13, "0").slice(0, 13));
    if (line.partidaArancelaria?.trim()) {
      ld.ele("PartidaArancelaria").txt(line.partidaArancelaria.replace(/\D/g, "").padStart(12, "0").slice(0, 12));
    }
    ld.ele("Cantidad").txt(fmtDecimal(Number(c.cantidad), 3));
    ld.ele("UnidadMedida").txt(line.unidadMedida);
    ld.ele("Detalle").txt(line.descripcion.slice(0, 200));
    ld.ele("PrecioUnitario").txt(fmtDecimal(Number(c.precioUnitario)));
    ld.ele("MontoTotal").txt(fmtDecimal(c.montoTotal));

    if (Number(c.montoDescuento) > 0) {
      const desc = ld.ele("Descuento");
      desc.ele("MontoDescuento").txt(fmtDecimal(Number(c.montoDescuento)));
      const codDesc = line.codigoDescuento?.trim() || "99";
      desc.ele("CodigoDescuento").txt(codDesc);
      const naturaleza = line.naturalezaDescuento?.trim() || "Descuento comercial";
      desc.ele("NaturalezaDescuento").txt(naturaleza.slice(0, 80));
      if (codDesc === "99" && naturaleza.length >= 3) {
        desc.ele("CodigoDescuentoOTRO").txt(naturaleza.slice(0, 100));
      }
    }

    ld.ele("SubTotal").txt(fmtDecimal(c.subTotal));
    if (c.baseImponible > 0) {
      ld.ele("BaseImponible").txt(fmtDecimal(c.baseImponible));
    }

    const impuestoMonto = Number(line.montoImpuesto);
    const codigoTarifa = c.codigoTarifaIVA;
    const impNode = ld
      .ele("Impuesto")
      .ele("Codigo")
      .txt("01")
      .up()
      .ele("CodigoTarifaIVA")
      .txt(codigoTarifa)
      .up()
      .ele("Tarifa")
      .txt(fmtDecimal(Number(line.tarifaImpuesto), 2))
      .up()
      .ele("Monto")
      .txt(fmtDecimal(impuestoMonto));

    if (line.exoneracion?.exonNumeroDocumento?.trim() && line.permitirExoneracion !== false) {
      const ex = line.exoneracion;
      const exNode = impNode.ele("Exoneracion");
      exNode.ele("TipoDocumento").txt((ex.exonTipoDocumento?.trim() || "02").slice(0, 2));
      exNode.ele("NumeroDocumento").txt(ex.exonNumeroDocumento!.trim().slice(0, 40));
      exNode.ele("NombreInstitucion").txt((ex.exonNombreInstitucion?.trim() || "Institución").slice(0, 160));
      exNode.ele("FechaEmision").txt(formatExonFecha(ex.exonFechaEmision ?? null));
      const pct = ex.exonPorcentaje != null ? Number(ex.exonPorcentaje.toString()) : 0;
      exNode.ele("PorcentajeExoneracion").txt(fmtDecimal(pct, 2));
      exNode.ele("MontoExoneracion").txt(fmtDecimal(ex.exonMontoCalculado));
    }

    if (line.ivaCobradoFabrica?.trim()) {
      ld.ele("IVACobradoFabrica").txt(line.ivaCobradoFabrica.trim().slice(0, 2));
    }
    if (line.montoImpuestoExportacion != null && Number(line.montoImpuestoExportacion) > 0) {
      ld.ele("MontoImpuestoExportacion").txt(fmtDecimal(Number(line.montoImpuestoExportacion)));
    }

    ld.ele("ImpuestoAsumidoEmisorFabrica").txt(fmtDecimal(c.impuestoAsumidoFabrica));
    ld.ele("ImpuestoNeto").txt(fmtDecimal(c.impuestoNeto));
    ld.ele("MontoTotalLinea").txt(fmtDecimal(Number(line.totalLinea)));
  }
}

export function buildLineaXmlFromDetalle(
  line: FeFacturaDetalle,
  index: number,
  calculada: FeLineaCalculada
): FeLineaXmlInput {
  return {
    numeroLinea: line.numeroLinea || index + 1,
    codigoCabys: line.codigoCabys,
    codigo: line.codigo,
    descripcion: line.descripcion,
    unidadMedida: line.unidadMedida,
    montoDescuento: Number(line.montoDescuento),
    codigoDescuento: line.codigoDescuento,
    naturalezaDescuento: line.naturalezaDescuento,
    calculada,
    montoImpuesto: Number(line.montoImpuesto),
    totalLinea: Number(line.totalLinea),
    tarifaImpuesto: Number(line.tarifaImpuesto),
    ivaCobradoFabrica: line.ivaCobradoFabrica,
    partidaArancelaria: line.partidaArancelaria,
    montoImpuestoExportacion:
      line.montoImpuestoExportacion != null ? Number(line.montoImpuestoExportacion) : null,
    exoneracion: line.exonNumeroDocumento?.trim()
      ? {
          exonTipoDocumento: line.exonTipoDocumento,
          exonNumeroDocumento: line.exonNumeroDocumento,
          exonNombreInstitucion: line.exonNombreInstitucion,
          exonFechaEmision: line.exonFechaEmision,
          exonPorcentaje: line.exonPorcentaje,
          exonMontoCalculado: calculada.exonMontoCalculado,
        }
      : null,
  };
}

export function appendResumenFacturaV44(params: {
  root: XmlNode;
  moneda: FeMoneda;
  tipoCambio: number;
  resumen: FeResumenCalculado;
  mediosPago: FeMedioPagoLinea[];
}) {
  const { root, resumen, mediosPago } = params;
  const resumenNode = root.ele("ResumenFactura");
  const moneda = FE_MONEDA_CODIGO[params.moneda];

  resumenNode
    .ele("CodigoTipoMoneda")
    .ele("CodigoMoneda")
    .txt(moneda.codigo)
    .up()
    .ele("TipoCambio")
    .txt(fmtDecimal(Number(params.tipoCambio)));

  resumenNode.ele("TotalServGravados").txt(fmtDecimal(resumen.totalServiciosGravados));
  resumenNode.ele("TotalServExentos").txt(fmtDecimal(resumen.totalServiciosExentos));
  resumenNode.ele("TotalServExonerado").txt(fmtDecimal(resumen.totalServiciosExonerados));
  resumenNode.ele("TotalServNoSujeto").txt(fmtDecimal(resumen.totalServiciosNoSujeto));
  resumenNode.ele("TotalMercanciasGravadas").txt(fmtDecimal(resumen.totalMercanciasGravadas));
  resumenNode.ele("TotalMercanciasExentas").txt(fmtDecimal(resumen.totalMercanciasExentas));
  resumenNode.ele("TotalMercExonerada").txt(fmtDecimal(resumen.totalMercanciasExoneradas));
  resumenNode.ele("TotalMercNoSujeta").txt(fmtDecimal(resumen.totalMercanciasNoSujetas));
  resumenNode.ele("TotalGravado").txt(fmtDecimal(resumen.totalGravado));
  resumenNode.ele("TotalExento").txt(fmtDecimal(resumen.totalExento));
  resumenNode.ele("TotalExonerado").txt(fmtDecimal(resumen.totalExonerado));
  resumenNode.ele("TotalNoSujeto").txt(fmtDecimal(resumen.totalNoSujeto));
  resumenNode.ele("TotalVenta").txt(fmtDecimal(resumen.totalVenta));
  resumenNode.ele("TotalDescuentos").txt(fmtDecimal(resumen.totalDescuentos));
  resumenNode.ele("TotalVentaNeta").txt(fmtDecimal(resumen.totalVentaNeta));

  for (const d of resumen.desgloseImpuestos) {
    resumenNode
      .ele("TotalDesgloseImpuesto")
      .ele("Codigo")
      .txt(d.codigo)
      .up()
      .ele("CodigoTarifaIVA")
      .txt(d.codigoTarifaIVA)
      .up()
      .ele("TotalMontoImpuesto")
      .txt(fmtDecimal(d.totalMontoImpuesto));
  }

  resumenNode.ele("TotalImpuesto").txt(fmtDecimal(resumen.totalImpuesto));
  resumenNode.ele("TotalImpAsumEmisorFabrica").txt(fmtDecimal(resumen.totalImpAsumEmisorFabrica));

  if (resumen.totalOtrosCargos > 0) {
    resumenNode.ele("TotalOtrosCargos").txt(fmtDecimal(resumen.totalOtrosCargos));
  }

  for (const mp of mediosPago) {
    const codigo = medioPagoCodigo(mp.tipo);
    const n = resumenNode.ele("MedioPago");
    n.ele("TipoMedioPago").txt(codigo);
    if (codigo === "99" && mp.otro?.trim()) {
      n.ele("MedioPagoOtros").txt(mp.otro.trim().slice(0, 100));
    }
    n.ele("TotalMedioPago").txt(fmtDecimal(mp.total));
  }

  if (resumen.totalIvaDevuelto > 0) {
    resumenNode.ele("TotalIVADevuelto").txt(fmtDecimal(resumen.totalIvaDevuelto));
  }

  resumenNode.ele("TotalComprobante").txt(fmtDecimal(resumen.totalComprobante));
}

export function appendOtrosCargos(root: XmlNode, cargos: FeOtroCargoLinea[]) {
  for (const cargo of cargos) {
    const node = root.ele("OtrosCargos");
    node.ele("TipoDocumento").txt(cargo.tipoDocumento.slice(0, 2));
    if (cargo.numeroIdentidadTercero?.trim()) {
      node.ele("NumeroIdentidadTercero").txt(cargo.numeroIdentidadTercero.replace(/\D/g, "").slice(0, 20));
    }
    if (cargo.nombreTercero?.trim()) {
      node.ele("NombreTercero").txt(cargo.nombreTercero.trim().slice(0, 100));
    }
    node.ele("Detalle").txt(cargo.detalle.slice(0, 160));
    if (cargo.porcentaje != null && cargo.porcentaje > 0) {
      node.ele("Porcentaje").txt(fmtDecimal(cargo.porcentaje, 2));
    }
    node.ele("MontoCargo").txt(fmtDecimal(cargo.montoCargo));
  }
}

export function appendCondicionVenta(params: {
  root: XmlNode;
  condicionVenta: FeCondicionVenta;
  condicionVentaOtro?: string | null;
  plazoCredito?: number | null;
}) {
  params.root.ele("CondicionVenta").txt(FE_CONDICION_VENTA_CODIGO[params.condicionVenta]);
  if (params.condicionVenta === "OTROS" && params.condicionVentaOtro?.trim()) {
    params.root.ele("CondicionVentaOtros").txt(params.condicionVentaOtro.trim().slice(0, 100));
  }
  if (params.plazoCredito && params.condicionVenta === "CREDITO") {
    params.root.ele("PlazoCredito").txt(String(params.plazoCredito));
  }
}

export function resolveProveedorSistemas(empresa: FeEmpresa): string {
  const explicit = empresa.proveedorSistemas?.trim().replace(/\D/g, "") ?? "";
  if (explicit) {
    return explicit.slice(0, 20);
  }
  // Fallback: misma identificación que el nodo Emisor/Identificacion/Numero.
  return empresa.cedulaJuridica.replace(/\D/g, "").slice(0, 20);
}

export function mapDetalleToLineaInput(line: FeFacturaDetalle) {
  return {
    cantidad: Number(line.cantidad),
    precioUnitario: Number(line.precioUnitario),
    montoDescuento: Number(line.montoDescuento),
    codigoCabys: line.codigoCabys,
    codigoTarifa: line.codigoImpuesto,
    tarifaImpuesto: Number(line.tarifaImpuesto),
    montoImpuesto: Number(line.montoImpuesto),
    totalLinea: Number(line.totalLinea),
    exonTipoDocumento: line.exonTipoDocumento,
    exonNumeroDocumento: line.exonNumeroDocumento,
    exonNombreInstitucion: line.exonNombreInstitucion,
    exonFechaEmision: line.exonFechaEmision,
    exonPorcentaje: line.exonPorcentaje != null ? Number(line.exonPorcentaje) : null,
    exonMonto: line.exonMonto != null ? Number(line.exonMonto) : null,
    ivaCobradoFabrica: line.ivaCobradoFabrica,
    impuestoAsumidoFabrica: Number(line.impuestoAsumidoFabrica ?? 0),
    partidaArancelaria: line.partidaArancelaria,
    montoImpuestoExportacion: line.montoImpuestoExportacion != null ? Number(line.montoImpuestoExportacion) : null,
  };
}
