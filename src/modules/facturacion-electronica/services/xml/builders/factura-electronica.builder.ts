import type {
  FeCliente,
  FeEmpresa,
  FeFactura,
  FeFacturaDetalle,
  FeComprobanteElectronico,
  FePuntoVenta,
  FeSucursal,
} from "@prisma/client";
import { buildDocumentoVentaXml } from "./documento-venta.builder";

export type FeFacturaXmlContext = {
  empresa: FeEmpresa;
  factura: FeFactura;
  detalles: FeFacturaDetalle[];
  cliente: FeCliente;
  comprobante: FeComprobanteElectronico;
  puntoVenta: FePuntoVenta & { sucursal: FeSucursal };
};

export function buildFacturaElectronicaXml(ctx: FeFacturaXmlContext): string {
  return buildDocumentoVentaXml({
    ...ctx,
    tipoDocumento: "FACTURA_ELECTRONICA",
  });
}

export { buildTiqueteElectronicoXml, buildFacturaExportacionXml } from "./documento-venta.builder";
