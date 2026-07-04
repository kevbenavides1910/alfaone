import type { FeJobTipo, PrismaClient } from "@prisma/client";
import { FeJobQueueRepository } from "../repositories/fe-job-queue.repository";
import { FeComprobanteEntregaService } from "../services/comprobante-entrega.service";
import { FeEmisionOrchestratorService } from "../services/emision-orchestrator.service";
import type { FeDocumentKind } from "../validators/nota.schema";
import { feLogger } from "../utils/logger";

type JobPayload = Record<string, unknown>;

function parsePayload(raw: string): JobPayload {
  try {
    return JSON.parse(raw) as JobPayload;
  } catch {
    return {};
  }
}

export class FeJobRunner {
  private readonly queue: FeJobQueueRepository;
  private readonly emision: FeEmisionOrchestratorService;
  private readonly entrega: FeComprobanteEntregaService;

  constructor(private readonly prisma: PrismaClient) {
    this.queue = new FeJobQueueRepository(prisma);
    this.emision = new FeEmisionOrchestratorService(prisma);
    this.entrega = new FeComprobanteEntregaService(prisma);
  }

  async runDueJobs(workerId = "fe-cron") {
    const jobs = await this.queue.claimDue(25, workerId);
    const summary = { processed: 0, failed: 0, byType: {} as Record<string, number> };

    for (const job of jobs) {
      summary.byType[job.jobType] = (summary.byType[job.jobType] ?? 0) + 1;
      try {
        await this.dispatch(job.jobType, parsePayload(job.payload));
        await this.queue.complete(job.id);
        summary.processed += 1;
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        feLogger.error("Job FE fallido", { jobId: job.id, jobType: job.jobType, error: message });
        await this.queue.fail(job.id, message, job.jobType === "CONSULTA_ESTADO" ? 120_000 : 60_000);
        summary.failed += 1;
      }
    }

    return summary;
  }

  private async dispatch(jobType: FeJobTipo, payload: JobPayload) {
    switch (jobType) {
      case "REINTENTO_ENVIO": {
        const companyCode = String(payload.companyCode ?? "");
        const documentKind = String(payload.documentKind ?? "factura");
        if (documentKind === "factura_compra") {
          await this.emision.procesarEnvioFacturaCompra(String(payload.facturaCompraId ?? ""), companyCode);
          return;
        }
        if (documentKind === "recibo_pago") {
          await this.emision.procesarEnvioReciboPago(String(payload.reciboPagoId ?? ""), companyCode);
          return;
        }
        const facturaId = String(payload.facturaId ?? "");
        await this.emision.procesarEnvioFactura(facturaId, companyCode);
        return;
      }
      case "CONSULTA_ESTADO": {
        const companyCode = String(payload.companyCode ?? "");
        const documentKind = String(payload.documentKind ?? "factura") as FeDocumentKind;
        const documentId = String(payload.documentId ?? payload.facturaId ?? "");
        const result = await this.emision.consultarEstadoDocumento(documentKind, documentId, companyCode);
        if (!result.terminal) {
          await this.queue.enqueue({
            jobType: "CONSULTA_ESTADO",
            comprobanteId: String(payload.comprobanteId ?? ""),
            runAt: new Date(Date.now() + 120_000),
            payload,
          });
        }
        return;
      }
      case "REENVIO_CORREO": {
        const companyCode = String(payload.companyCode ?? "");
        const documentKind = String(payload.documentKind ?? "factura");
        const forzar = Boolean(payload.forzar);
        if (documentKind === "factura_compra") {
          await this.entrega.enviarCorreoFacturaCompra(String(payload.facturaCompraId ?? ""), companyCode, { forzar });
          return;
        }
        if (documentKind === "recibo_pago") {
          await this.entrega.enviarCorreoReciboPago(String(payload.reciboPagoId ?? ""), companyCode, { forzar });
          return;
        }
        if (documentKind === "nota_credito") {
          await this.entrega.enviarCorreoNota("nota_credito", String(payload.notaId ?? payload.documentId ?? ""), companyCode, { forzar });
          return;
        }
        if (documentKind === "nota_debito") {
          await this.entrega.enviarCorreoNota("nota_debito", String(payload.notaId ?? payload.documentId ?? ""), companyCode, { forzar });
          return;
        }
        await this.entrega.enviarCorreoFactura(String(payload.facturaId ?? ""), companyCode, { forzar });
        return;
      }
      case "LIMPIEZA_ERRORES":
      case "GENERACION_LOGS":
        feLogger.info("Job FE registrado, handler pendiente", { jobType, payload });
        return;
      case "PROCESAR_CORREO_ENTRANTE": {
        const { FeIncomingMailService } = await import("../services/incoming/incoming-mail.service");
        const incoming = new FeIncomingMailService(this.prisma);
        const companyCode = String(payload.companyCode ?? "");
        if (companyCode) {
          await incoming.pollEmpresa(companyCode);
        } else {
          await incoming.pollAllEmpresas();
        }
        return;
      }
      default:
        feLogger.warn("Tipo de job FE desconocido", { jobType });
    }
  }
}
