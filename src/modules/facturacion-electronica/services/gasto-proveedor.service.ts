import fs from "fs/promises";
import type { FeComprobanteRecibidoEstado, PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeGastoProveedorRepository } from "../repositories/fe-gasto-proveedor.repository";
import { parseGastoFromRecibidoXml } from "./incoming/gasto-recibido.parser";
import { feAbsolutePath } from "../utils/fe-storage";
import { feLogger } from "../utils/logger";

const ESTADOS_GASTO = new Set<FeComprobanteRecibidoEstado>([
  "ACEPTADO",
  "ACEPTADO_PARCIAL",
  "AUTO_ACEPTADO",
]);

function endOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export class FeGastoProveedorService {
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly repo: FeGastoProveedorRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.repo = new FeGastoProveedorRepository(prisma);
  }

  async registrarDesdeRecibido(params: {
    companyCode: string;
    comprobanteRecibidoId: string;
    xmlPath: string | null;
    estadoRecibo: FeComprobanteRecibidoEstado;
    fallback?: {
      clave: string;
      cedulaEmisor: string;
      nombreEmisor?: string | null;
      fechaEmision?: Date | null;
      montoTotal?: number | null;
      montoTotalImpuesto?: number | null;
    };
    userId?: string;
  }) {
    if (!ESTADOS_GASTO.has(params.estadoRecibo)) return null;

    const empresa = await this.empresaRepo.findByCompanyCode(params.companyCode);
    const existing = await this.repo.findByComprobanteRecibidoId(params.comprobanteRecibidoId);
    if (existing) return existing;

    let parsed = null;
    if (params.xmlPath?.trim()) {
      try {
        const xml = await fs.readFile(feAbsolutePath(params.xmlPath), "utf8");
        parsed = parseGastoFromRecibidoXml(xml);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        feLogger.warn("No se pudo leer XML para gasto", {
          comprobanteRecibidoId: params.comprobanteRecibidoId,
          error: message,
        });
      }
    }

    if (!parsed && params.fallback) {
      const total = params.fallback.montoTotal ?? 0;
      const totalImpuestos = params.fallback.montoTotalImpuesto ?? 0;
      parsed = {
        clave: params.fallback.clave,
        cedulaEmisor: params.fallback.cedulaEmisor,
        nombreEmisor: params.fallback.nombreEmisor ?? null,
        consecutivo: null,
        fechaEmision: params.fallback.fechaEmision ?? new Date(),
        tipoComprobante: null,
        moneda: "CRC" as const,
        tipoCambio: 1,
        subtotal: Math.max(0, total - totalImpuestos),
        totalDescuentos: 0,
        totalImpuestos,
        total,
        impuestos:
          totalImpuestos > 0
            ? [
                {
                  codigoImpuesto: "01",
                  codigoTarifaIVA: "08",
                  tarifaPercent: 13,
                  montoImpuesto: totalImpuestos,
                },
              ]
            : [],
      };
    }

    if (!parsed) {
      feLogger.warn("Gasto no registrado: sin datos parseables", {
        comprobanteRecibidoId: params.comprobanteRecibidoId,
      });
      return null;
    }

    return this.repo.createFromParsed({
      empresaId: empresa.id,
      comprobanteRecibidoId: params.comprobanteRecibidoId,
      parsed,
      estadoRecibo: params.estadoRecibo,
      userId: params.userId,
    });
  }

  async resumen(companyCode: string, desde: Date, hasta: Date) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const desdeNorm = startOfDay(desde);
    const hastaNorm = endOfDay(hasta);
    if (desdeNorm > hastaNorm) {
      throw new FeDomainError("Rango de fechas inválido", "FE_FECHA_RANGO_INVALIDO", 400);
    }

    const [items, totales, impuestos] = await Promise.all([
      this.repo.listByFecha({ empresaId: empresa.id, desde: desdeNorm, hasta: hastaNorm }),
      this.repo.sumTotales({ empresaId: empresa.id, desde: desdeNorm, hasta: hastaNorm }),
      this.repo.aggregateImpuestos({ empresaId: empresa.id, desde: desdeNorm, hasta: hastaNorm }),
    ]);

    return {
      desde: desdeNorm.toISOString(),
      hasta: hastaNorm.toISOString(),
      cantidad: totales._count,
      totales: {
        subtotal: Number(totales._sum.subtotal ?? 0),
        descuentos: Number(totales._sum.totalDescuentos ?? 0),
        impuestos: Number(totales._sum.totalImpuestos ?? 0),
        total: Number(totales._sum.total ?? 0),
      },
      ivaPorTarifa: impuestos.map((row) => ({
        tarifaPercent: Number(row.tarifaPercent),
        codigoTarifaIVA: row.codigoTarifaIVA,
        montoImpuesto: Number(row._sum.montoImpuesto ?? 0),
      })),
      items: items.map((row) => ({
        id: row.id,
        clave: row.clave,
        fechaEmision: row.fechaEmision.toISOString(),
        cedulaEmisor: row.cedulaEmisor,
        nombreEmisor: row.nombreEmisor,
        total: Number(row.total),
        totalImpuestos: Number(row.totalImpuestos),
        moneda: row.moneda,
        estadoRecibo: row.estadoRecibo,
        impuestos: row.impuestos.map((imp) => ({
          tarifaPercent: Number(imp.tarifaPercent),
          codigoTarifaIVA: imp.codigoTarifaIVA,
          montoImpuesto: Number(imp.montoImpuesto),
        })),
      })),
    };
  }
}
