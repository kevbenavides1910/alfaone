import type { PrismaClient } from "@prisma/client";
import { FeFacturaService } from "../services/factura.service";
import { FeEmisionOrchestratorService } from "../services/emision-orchestrator.service";
import type { CreateFeFacturaInput, ListFeFacturasQuery } from "../validators/factura.schema";
import { FeComprobanteEntregaService } from "../services/comprobante-entrega.service";

export class FeFacturaController {
  private readonly facturas: FeFacturaService;
  private readonly emision: FeEmisionOrchestratorService;
  private readonly entrega: FeComprobanteEntregaService;

  constructor(prisma: PrismaClient) {
    this.facturas = new FeFacturaService(prisma);
    this.emision = new FeEmisionOrchestratorService(prisma);
    this.entrega = new FeComprobanteEntregaService(prisma);
  }

  create(companyCode: string, input: CreateFeFacturaInput, userId?: string) {
    return this.facturas.create(companyCode, input, userId);
  }

  list(companyCode: string, query: ListFeFacturasQuery) {
    return this.facturas.list(companyCode, query);
  }

  getById(companyCode: string, id: string) {
    return this.facturas.getById(companyCode, id);
  }

  update(companyCode: string, id: string, input: CreateFeFacturaInput, userId?: string) {
    return this.facturas.updateDraft(companyCode, id, input, userId);
  }

  enviar(companyCode: string, id: string, userId?: string) {
    return this.emision.procesarEnvioFactura(id, companyCode, userId);
  }

  estado(companyCode: string, id: string) {
    return this.emision.consultarEstadoFactura(id, companyCode);
  }

  async reenviarCorreo(companyCode: string, id: string) {
    const factura = await this.facturas.getById(companyCode, id);
    const hacienda = factura.comprobante?.estadoHaciendaActual;
    const necesitaRespuesta =
      factura.comprobante &&
      !factura.comprobante.xmlRespuestaPath &&
      hacienda &&
      ["ACEPTADO", "ACEPTADO_PARCIALMENTE", "RECHAZADO"].includes(hacienda);

    if (necesitaRespuesta) {
      await this.emision.consultarEstadoFactura(id, companyCode);
    }

    return this.entrega.enviarCorreoFactura(id, companyCode, { forzar: true });
  }
}
