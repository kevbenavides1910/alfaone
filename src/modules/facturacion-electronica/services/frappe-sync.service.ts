import { readFile } from "fs/promises";
import type { FeFacturaEstado, PrismaClient } from "@prisma/client";
import { feAbsolutePath } from "../utils/fe-storage";
import { feLogger } from "../utils/logger";
import { notDeleted } from "../utils/soft-delete";

export type FrappeSyncConfig = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  company: string;
  enabled: boolean;
};

const ESTADOS_SYNC = new Set<string>(["ACEPTADA", "ACEPTADA_PARCIALMENTE"]);

function envConfig(): FrappeSyncConfig {
  const baseUrl = (process.env.FRAPPE_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.FRAPPE_API_KEY || "";
  const apiSecret = process.env.FRAPPE_API_SECRET || "";
  const company = process.env.FRAPPE_COMPANY || "Grupo Alfa";
  return {
    baseUrl,
    apiKey,
    apiSecret,
    company,
    enabled: Boolean(baseUrl && apiKey && apiSecret),
  };
}

async function readFileB64(relativePath: string | null | undefined): Promise<string | undefined> {
  if (!relativePath) return undefined;
  try {
    const buf = await readFile(feAbsolutePath(relativePath));
    return buf.toString("base64");
  } catch {
    return undefined;
  }
}

function decimalToNumber(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === "number") return value;
  return Number(value);
}

export class FeFrappeSyncService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly config: FrappeSyncConfig = envConfig()
  ) {}

  isConfigured() {
    return this.config.enabled;
  }

  /** Encola sync si el estado es terminal aceptado y Frappe está configurado. */
  shouldSync(estado: string) {
    return this.config.enabled && ESTADOS_SYNC.has(estado);
  }

  async syncFactura(facturaId: string, companyCode: string) {
    if (!this.config.enabled) {
      feLogger.info("Sync Frappe omitido: FRAPPE_* no configurado", { facturaId });
      return { skipped: true as const, reason: "not_configured" };
    }

    const factura = await this.prisma.feFactura.findFirst({
      where: { id: facturaId, ...notDeleted },
      include: {
        cliente: true,
        detalles: { where: notDeleted, orderBy: { numeroLinea: "asc" } },
        comprobante: {
          include: {
            adjuntosPdf: { where: notDeleted, orderBy: { createdAt: "desc" }, take: 1 },
          },
        },
        empresa: { select: { actividadEconomica: true, companyCode: true } },
      },
    });

    if (!factura) {
      throw new Error(`Factura FE no encontrada: ${facturaId}`);
    }
    if (!factura.comprobante?.claveNumerica) {
      throw new Error(`Factura ${facturaId} sin clave Hacienda`);
    }

    const estado = factura.estado as FeFacturaEstado;
    if (!ESTADOS_SYNC.has(estado)) {
      return { skipped: true as const, reason: "estado_no_aceptada", estado };
    }

    const pdfPath = factura.comprobante.adjuntosPdf[0]?.storagePath;
    const payload = {
      company: this.config.company,
      companyCode: companyCode || factura.empresa.companyCode,
      alfaFacturaId: factura.id,
      clave: factura.comprobante.claveNumerica,
      consecutivo: factura.comprobante.consecutivo,
      estado: factura.estado,
      fecha: factura.fecha.toISOString(),
      moneda: factura.moneda,
      tipoCambio: decimalToNumber(factura.tipoCambio),
      condicionVenta: factura.condicionVenta,
      medioPago: factura.medioPago,
      plazoCredito: factura.plazoCredito ?? undefined,
      actividadEconomica: factura.empresa.actividadEconomica ?? undefined,
      actividadReceptor: factura.cliente?.actividadEconomica ?? undefined,
      observaciones: factura.observaciones ?? undefined,
      subtotal: decimalToNumber(factura.subtotal),
      totalDescuentos: decimalToNumber(factura.totalDescuentos),
      totalImpuestos: decimalToNumber(factura.totalImpuestos),
      total: decimalToNumber(factura.total),
      receptor: factura.cliente
        ? {
            alfaClienteId: factura.cliente.id,
            externalRef: factura.cliente.externalRef ?? undefined,
            tipoIdentificacion: factura.cliente.tipoIdentificacion,
            identificacion: factura.cliente.identificacion,
            nombre: factura.cliente.nombre,
            nombreComercial: factura.cliente.nombreComercial ?? undefined,
            actividadEconomica: factura.cliente.actividadEconomica ?? undefined,
            email: factura.cliente.email ?? undefined,
            telefono: factura.cliente.telefono ?? undefined,
          }
        : undefined,
      lineas: factura.detalles.map((d) => ({
        numeroLinea: d.numeroLinea,
        codigo: d.codigo ?? undefined,
        codigoCabys: d.codigoCabys ?? undefined,
        descripcion: d.descripcion,
        cantidad: decimalToNumber(d.cantidad),
        unidadMedida: d.unidadMedida,
        precioUnitario: decimalToNumber(d.precioUnitario),
        montoDescuento: decimalToNumber(d.montoDescuento),
        naturalezaDescuento: d.naturalezaDescuento ?? undefined,
        codigoImpuesto: d.codigoImpuesto ?? undefined,
        tarifaImpuesto: decimalToNumber(d.tarifaImpuesto),
        montoImpuesto: decimalToNumber(d.montoImpuesto),
        totalLinea: decimalToNumber(d.totalLinea),
      })),
      xmlFirmadoB64: await readFileB64(factura.comprobante.xmlFirmadoPath),
      xmlRespuestaB64: await readFileB64(factura.comprobante.xmlRespuestaPath),
      pdfB64: await readFileB64(pdfPath),
    };

    const result = await this.postUpsert(payload);

    const siName = typeof result.sales_invoice === "string" ? result.sales_invoice : null;
    if (siName && !factura.asientoContableRef?.startsWith("frappe:")) {
      await this.prisma.feFactura.update({
        where: { id: factura.id },
        data: {
          asientoContableRef: `frappe:${siName}`,
          contabilizadoAt: factura.contabilizadoAt ?? new Date(),
        },
      });
    }

    feLogger.info("Sync Frappe OK", {
      facturaId,
      clave: payload.clave,
      salesInvoice: siName,
      created: result.created,
    });

    return { skipped: false as const, result };
  }

  private async postUpsert(payload: Record<string, unknown>) {
    const url = `${this.config.baseUrl}/api/method/facturacion_cr.sync_alfa.upsert_sales_invoice_from_fe`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${this.config.apiKey}:${this.config.apiSecret}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ data: payload }),
    });

    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      /* raw */
    }

    if (!res.ok) {
      const exc = (json as { exc?: string; message?: string }).exc
        || (json as { message?: string }).message
        || text.slice(0, 800);
      throw new Error(`Frappe HTTP ${res.status}: ${exc}`);
    }

    const message = (json.message ?? json) as Record<string, unknown>;
    if (message && typeof message === "object" && message.ok === false) {
      throw new Error(`Frappe sync rechazado: ${JSON.stringify(message)}`);
    }
    return message as {
      ok?: boolean;
      created?: boolean;
      sales_invoice?: string;
      customer?: string;
      clave?: string;
    };
  }
}
