import type { PrismaClient } from "@prisma/client";
import { FeMensajeReceptorService } from "../services/mensaje-receptor.service";
import { FeEmisionOrchestratorService } from "../services/emision-orchestrator.service";
import type { CreateFeMensajeReceptorInput } from "../validators/mensaje-receptor.schema";

export class FeMensajeReceptorController {
  private readonly mensajes: FeMensajeReceptorService;
  private readonly emision: FeEmisionOrchestratorService;

  constructor(prisma: PrismaClient) {
    this.mensajes = new FeMensajeReceptorService(prisma);
    this.emision = new FeEmisionOrchestratorService(prisma);
  }

  create(companyCode: string, input: CreateFeMensajeReceptorInput, userId?: string) {
    return this.mensajes.create(companyCode, input, userId);
  }

  list(companyCode: string) {
    return this.mensajes.list(companyCode);
  }

  getById(companyCode: string, id: string) {
    return this.mensajes.getById(companyCode, id);
  }

  enviar(companyCode: string, id: string, userId?: string) {
    return this.emision.procesarEnvioMensajeReceptor(id, companyCode, userId);
  }
}
