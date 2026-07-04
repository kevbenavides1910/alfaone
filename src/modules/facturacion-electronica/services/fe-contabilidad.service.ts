import type { PrismaClient } from "@prisma/client";
import {
  defaultAsientoContableProvider,
  type AsientoContableProvider,
} from "../interfaces/contabilidad/asiento-contable.provider";
import type { FeDocumentKind } from "../validators/nota.schema";
import { notDeleted } from "../utils/soft-delete";
import { feLogger } from "../utils/logger";

const ESTADOS_CONTABILIZAR = new Set(["ACEPTADA", "ACEPTADA_PARCIALMENTE"]);

export class FeContabilidadService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly provider: AsientoContableProvider = defaultAsientoContableProvider
  ) {}

  async contabilizarSiCorresponde(kind: FeDocumentKind, documentId: string, estado: string) {
    if (!ESTADOS_CONTABILIZAR.has(estado)) return null;
    if (kind === "mensaje_receptor") return null;

    try {
      if (kind === "factura") return await this.contabilizarFactura(documentId);
      if (kind === "nota_credito") return await this.contabilizarNotaCredito(documentId);
      return await this.contabilizarNotaDebito(documentId);
    } catch (e) {
      feLogger.warn("Contabilización FE fallida", {
        kind,
        documentId,
        error: e instanceof Error ? e.message : String(e),
      });
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async contabilizarFactura(facturaId: string) {
    const row = await this.prisma.feFactura.findFirst({ where: { id: facturaId, ...notDeleted } });
    if (!row || row.contabilizadoAt) return { skipped: true as const };

    const ref = await this.provider.generarAsientoDesdeFactura(facturaId);
    const asientoContableRef = `${ref.module}:${ref.asientoId}`;
    await this.prisma.feFactura.update({
      where: { id: facturaId },
      data: { asientoContableRef, contabilizadoAt: new Date() },
    });
    return { skipped: false as const, ref: asientoContableRef };
  }

  private async contabilizarNotaCredito(notaId: string) {
    const row = await this.prisma.feNotaCredito.findFirst({ where: { id: notaId, ...notDeleted } });
    if (!row || row.contabilizadoAt) return { skipped: true as const };

    const ref = await this.provider.generarAsientoDesdeNotaCredito(notaId);
    const asientoContableRef = `${ref.module}:${ref.asientoId}`;
    await this.prisma.feNotaCredito.update({
      where: { id: notaId },
      data: { asientoContableRef, contabilizadoAt: new Date() },
    });
    return { skipped: false as const, ref: asientoContableRef };
  }

  private async contabilizarNotaDebito(notaId: string) {
    const row = await this.prisma.feNotaDebito.findFirst({ where: { id: notaId, ...notDeleted } });
    if (!row || row.contabilizadoAt) return { skipped: true as const };

    const ref = await this.provider.generarAsientoDesdeNotaDebito(notaId);
    const asientoContableRef = `${ref.module}:${ref.asientoId}`;
    await this.prisma.feNotaDebito.update({
      where: { id: notaId },
      data: { asientoContableRef, contabilizadoAt: new Date() },
    });
    return { skipped: false as const, ref: asientoContableRef };
  }
}
