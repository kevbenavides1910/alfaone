import type {
  FeCliente,
  FeCondicionVenta,
  FeFactura,
  FeFacturaCompra,
  FeMedioPago,
  FeMoneda,
  FeNotaReferenciaTipo,
  FeReciboPago,
} from "@prisma/client";
import { FE_TIPO_COMPROBANTE_CODIGO, feTipoDocReferenciaFromComprobante } from "../constants/tipos-comprobante";
import { FeDomainError } from "../errors/fe-errors";

export type FeNotaReceptorXml = {
  nombre: string;
  tipoIdentificacion: FeCliente["tipoIdentificacion"];
  identificacion: string;
  actividadEconomica?: string | null;
  direccionProvincia?: string | null;
  direccionCanton?: string | null;
  direccionDistrito?: string | null;
  direccionBarrio?: string | null;
  direccionOtras?: string | null;
  email?: string | null;
};

export type FeNotaReferenciaSnapshot = {
  referenciaTipo: FeNotaReferenciaTipo;
  tipoDocReferencia: string;
  claveReferencia: string;
  fechaReferencia: Date;
  puntoVentaId: string;
  condicionVenta: FeCondicionVenta;
  condicionVentaOtro?: string | null;
  plazoCredito?: number | null;
  moneda: FeMoneda;
  tipoCambio: number;
  medioPago: FeMedioPago;
  medioPagoOtro?: string | null;
  mediosPago?: unknown;
  totalOtrosCargos?: number;
  otrosCargos?: unknown;
  totalIvaDevuelto?: number;
  receptor: FeNotaReceptorXml | null;
  esExportacion: boolean;
};

type NotaWithRefs = {
  claveReferencia: string;
  tipoDocReferencia: string;
  referenciaTipo: FeNotaReferenciaTipo;
  facturaReferencia?: (FeFactura & { comprobante?: { fechaEmision: Date } | null; cliente?: FeCliente | null }) | null;
  facturaCompraReferencia?: (FeFacturaCompra & { comprobante?: { fechaEmision: Date } | null }) | null;
  reciboPagoReferencia?:
    | (FeReciboPago & {
        comprobante?: { fechaEmision: Date } | null;
        facturaReferencia?: { cliente?: FeCliente | null } | null;
      })
    | null;
};

function dec(value: { toString(): string } | number | string) {
  return Number(value.toString());
}

export function buildNotaReferenciaSnapshot(nota: NotaWithRefs): FeNotaReferenciaSnapshot {
  const tipo = nota.referenciaTipo;

  if (tipo === "FACTURA_VENTA" && nota.facturaReferencia) {
    const f = nota.facturaReferencia;
    const cliente = f.cliente;
    return {
      referenciaTipo: tipo,
      tipoDocReferencia: nota.tipoDocReferencia || feTipoDocReferenciaFromComprobante(f.tipoDocumento),
      claveReferencia: nota.claveReferencia,
      fechaReferencia: f.comprobante?.fechaEmision ?? f.fecha,
      puntoVentaId: f.puntoVentaId,
      condicionVenta: f.condicionVenta,
      condicionVentaOtro: f.condicionVentaOtro,
      plazoCredito: f.plazoCredito,
      moneda: f.moneda,
      tipoCambio: dec(f.tipoCambio),
      medioPago: f.medioPago,
      medioPagoOtro: f.medioPagoOtro,
      mediosPago: f.mediosPago,
      totalOtrosCargos: dec(f.totalOtrosCargos),
      otrosCargos: f.otrosCargos,
      totalIvaDevuelto: dec(f.totalIvaDevuelto),
      receptor: cliente
        ? {
            nombre: cliente.nombre,
            tipoIdentificacion: cliente.tipoIdentificacion,
            identificacion: cliente.identificacion,
            actividadEconomica: cliente.actividadEconomica,
            direccionProvincia: cliente.direccionProvincia,
            direccionCanton: cliente.direccionCanton,
            direccionDistrito: cliente.direccionDistrito,
            direccionBarrio: cliente.direccionBarrio,
            direccionOtras: cliente.direccionOtras,
            email: cliente.email,
          }
        : null,
      esExportacion: f.tipoDocumento === "FACTURA_ELECTRONICA_EXPORTACION",
    };
  }

  if (tipo === "FACTURA_COMPRA" && nota.facturaCompraReferencia) {
    const c = nota.facturaCompraReferencia;
    const tipoId =
      c.proveedorTipoIdentificacion === "EXTRANJERO"
        ? ("EXTRANJERO" as const)
        : c.proveedorTipoIdentificacion === "FISICA"
          ? ("FISICA" as const)
          : c.proveedorTipoIdentificacion === "JURIDICA"
            ? ("JURIDICA" as const)
            : ("EXTRANJERO" as const);
    return {
      referenciaTipo: tipo,
      tipoDocReferencia: nota.tipoDocReferencia || FE_TIPO_COMPROBANTE_CODIGO.FACTURA_ELECTRONICA_COMPRA,
      claveReferencia: nota.claveReferencia,
      fechaReferencia: c.comprobante?.fechaEmision ?? c.fecha,
      puntoVentaId: c.puntoVentaId,
      condicionVenta: c.condicionVenta,
      moneda: c.moneda,
      tipoCambio: dec(c.tipoCambio),
      medioPago: "TRANSFERENCIA_DEPOSITO",
      receptor: {
        nombre: c.proveedorNombre,
        tipoIdentificacion: tipoId,
        identificacion: c.proveedorIdentificacion,
        direccionOtras: c.proveedorOtrasSenasExtranjero,
      },
      esExportacion: false,
    };
  }

  if (tipo === "RECIBO_PAGO" && nota.reciboPagoReferencia) {
    const r = nota.reciboPagoReferencia;
    const cliente = r.facturaReferencia?.cliente ?? null;
    return {
      referenciaTipo: tipo,
      tipoDocReferencia: nota.tipoDocReferencia || FE_TIPO_COMPROBANTE_CODIGO.RECIBO_ELECTRONICO_PAGO,
      claveReferencia: nota.claveReferencia,
      fechaReferencia: r.comprobante?.fechaEmision ?? r.fechaReferencia ?? new Date(),
      puntoVentaId: r.puntoVentaId,
      condicionVenta: r.condicionVenta,
      moneda: "CRC",
      tipoCambio: 1,
      medioPago: r.medioPago,
      medioPagoOtro: r.medioPagoOtro,
      receptor: cliente
        ? {
            nombre: cliente.nombre,
            tipoIdentificacion: cliente.tipoIdentificacion,
            identificacion: cliente.identificacion,
            actividadEconomica: cliente.actividadEconomica,
            direccionProvincia: cliente.direccionProvincia,
            direccionCanton: cliente.direccionCanton,
            direccionDistrito: cliente.direccionDistrito,
            direccionBarrio: cliente.direccionBarrio,
            direccionOtras: cliente.direccionOtras,
            email: cliente.email,
          }
        : null,
      esExportacion: false,
    };
  }

  throw new FeDomainError("Referencia de nota inválida o incompleta", "FE_NOTA_REF_INVALIDA");
}

export type FeNotaReferenciaResuelta = {
  claveReferencia: string;
  tipoDocReferencia: string;
};

export function notaEmpresaWhere(empresaId: string) {
  return {
    OR: [
      { facturaReferencia: { empresaId, deletedAt: null } },
      { facturaCompraReferencia: { empresaId, deletedAt: null } },
      { reciboPagoReferencia: { empresaId, deletedAt: null } },
    ],
  };
}

export const notaReferenciaInclude = {
  facturaReferencia: {
    include: { cliente: true, comprobante: true, empresa: true, puntoVenta: { include: { sucursal: true } } },
  },
  facturaCompraReferencia: {
    include: { comprobante: true, empresa: true, puntoVenta: { include: { sucursal: true } } },
  },
  reciboPagoReferencia: {
    include: {
      comprobante: true,
      empresa: true,
      puntoVenta: { include: { sucursal: true } },
      facturaReferencia: { include: { cliente: true } },
    },
  },
} as const;
