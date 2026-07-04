import type { PrismaClient } from "@prisma/client";
import { FeNotaService } from "../services/nota.service";
import { FeEmisionOrchestratorService } from "../services/emision-orchestrator.service";
import { FeComprobanteEntregaService } from "../services/comprobante-entrega.service";
import type { CreateFeNotaInput } from "../validators/nota.schema";

const ESTADOS_HACIENDA_TERMINALES = new Set(["ACEPTADO", "ACEPTADO_PARCIALMENTE", "RECHAZADO"]);

export class FeNotaController {
  private readonly notas: FeNotaService;
  private readonly emision: FeEmisionOrchestratorService;
  private readonly entrega: FeComprobanteEntregaService;

  constructor(prisma: PrismaClient) {
    this.notas = new FeNotaService(prisma);
    this.emision = new FeEmisionOrchestratorService(prisma);
    this.entrega = new FeComprobanteEntregaService(prisma);
  }

  createCredito(companyCode: string, input: CreateFeNotaInput, userId?: string) {
    return this.notas.createCredito(companyCode, input, userId);
  }

  createDebito(companyCode: string, input: CreateFeNotaInput, userId?: string) {
    return this.notas.createDebito(companyCode, input, userId);
  }

  getCreditoById(companyCode: string, id: string) {
    return this.notas.getCreditoById(companyCode, id);
  }

  getDebitoById(companyCode: string, id: string) {
    return this.notas.getDebitoById(companyCode, id);
  }

  enviarCredito(companyCode: string, id: string, userId?: string) {
    return this.emision.procesarEnvioNotaCredito(id, companyCode, userId);
  }

  enviarDebito(companyCode: string, id: string, userId?: string) {
    return this.emision.procesarEnvioNotaDebito(id, companyCode, userId);
  }

  consultarEstadoCredito(companyCode: string, id: string) {
    return this.emision.consultarEstadoDocumento("nota_credito", id, companyCode);
  }

  consultarEstadoDebito(companyCode: string, id: string) {
    return this.emision.consultarEstadoDocumento("nota_debito", id, companyCode);
  }

  reenviarCorreoCredito(companyCode: string, id: string) {
    return this.reenviarCorreoNota("nota_credito", companyCode, id);
  }

  reenviarCorreoDebito(companyCode: string, id: string) {
    return this.reenviarCorreoNota("nota_debito", companyCode, id);
  }

  private async reenviarCorreoNota(
    kind: "nota_credito" | "nota_debito",
    companyCode: string,
    id: string
  ) {
    const nota =
      kind === "nota_credito"
        ? await this.notas.getCreditoById(companyCode, id)
        : await this.notas.getDebitoById(companyCode, id);

    const hacienda = nota.comprobante?.estadoHaciendaActual;
    const necesitaRespuesta =
      nota.comprobante &&
      !nota.comprobante.xmlRespuestaPath &&
      hacienda &&
      ESTADOS_HACIENDA_TERMINALES.has(hacienda);

    if (necesitaRespuesta) {
      await this.emision.consultarEstadoDocumento(kind, id, companyCode);
    }

    return this.entrega.enviarCorreoNota(kind, id, companyCode, { forzar: true });
  }
}
