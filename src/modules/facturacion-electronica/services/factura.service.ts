import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeClienteRepository } from "../repositories/fe-cliente.repository";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeFacturaRepository } from "../repositories/fe-factura.repository";
import type { CreateFeFacturaInput, ListFeFacturasQuery } from "../validators/factura.schema";
import { baseImponibleDesdeIva, baseLineaDetalle } from "../utils/fe-base-imponible";
import { tarifaPercentToCodigoTarifaIVA } from "../utils/fe-tarifa-iva";
import { notDeleted } from "../utils/soft-delete";

const ESTADOS_ACEPTADOS = ["ACEPTADA", "ACEPTADA_PARCIALMENTE"] as const;

type IvaAggRow = {
  tarifaPercent: number;
  codigoTarifaIVA: string;
  montoBase: number;
  montoImpuesto: number;
};

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

function accumulateIva(
  map: Map<string, IvaAggRow>,
  params: {
    tarifaPercent: number;
    codigoTarifaIVA: string;
    montoBase: number;
    montoImpuesto: number;
    sign: 1 | -1;
  }
) {
  const tarifaPercent = Number(params.tarifaPercent);
  if (!Number.isFinite(tarifaPercent)) return;
  const codigo =
    params.codigoTarifaIVA?.trim() || tarifaPercentToCodigoTarifaIVA(tarifaPercent);
  const key = `${codigo}:${tarifaPercent}`;
  const prev = map.get(key) ?? {
    tarifaPercent,
    codigoTarifaIVA: codigo,
    montoBase: 0,
    montoImpuesto: 0,
  };
  prev.montoBase += params.sign * params.montoBase;
  prev.montoImpuesto += params.sign * params.montoImpuesto;
  map.set(key, prev);
}

function lineBaseAndIva(line: {
  cantidad: unknown;
  precioUnitario: unknown;
  montoDescuento?: unknown;
  tarifaImpuesto: unknown;
  montoImpuesto: unknown;
  codigoImpuesto?: string | null;
}) {
  const tarifaPercent = Number(line.tarifaImpuesto);
  const montoImpuesto = Number(line.montoImpuesto);
  let montoBase = baseLineaDetalle({
    cantidad: line.cantidad as number,
    precioUnitario: line.precioUnitario as number,
    montoDescuento: line.montoDescuento as number,
  });
  if (montoBase <= 0 && montoImpuesto > 0 && tarifaPercent > 0) {
    montoBase = baseImponibleDesdeIva(montoImpuesto, tarifaPercent);
  }
  return {
    tarifaPercent,
    codigoTarifaIVA: line.codigoImpuesto?.trim() || tarifaPercentToCodigoTarifaIVA(tarifaPercent),
    montoBase,
    montoImpuesto: Number.isFinite(montoImpuesto) ? montoImpuesto : 0,
  };
}

export class FeFacturaService {
  private readonly facturaRepo: FeFacturaRepository;
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly clienteRepo: FeClienteRepository;
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.facturaRepo = new FeFacturaRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.clienteRepo = new FeClienteRepository(prisma);
  }

  async create(companyCode: string, input: CreateFeFacturaInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.assertPuntoVentaBelongsToEmpresa(input.puntoVentaId, empresa.id);
    if (input.clienteId) {
      await this.clienteRepo.findById(input.clienteId, empresa.id);
    } else if (input.tipoDocumento !== "TIQUETE_ELECTRONICO") {
      throw new FeDomainError("Cliente requerido", "FE_CLIENTE_REQUERIDO", 400);
    }

    if (input.facturaMensualId) {
      await this.assertFacturaMensualLinkable(input.facturaMensualId, companyCode);
    }

    return this.facturaRepo.create(empresa.id, input, userId);
  }

  async updateDraft(companyCode: string, facturaId: string, input: CreateFeFacturaInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.assertPuntoVentaBelongsToEmpresa(input.puntoVentaId, empresa.id);
    if (input.clienteId) {
      await this.clienteRepo.findById(input.clienteId, empresa.id);
    } else if (input.tipoDocumento !== "TIQUETE_ELECTRONICO") {
      throw new FeDomainError("Cliente requerido", "FE_CLIENTE_REQUERIDO", 400);
    }
    return this.facturaRepo.updateDraft(empresa.id, facturaId, input, userId);
  }

  async getById(companyCode: string, facturaId: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    return this.facturaRepo.findById(facturaId, empresa.id);
  }

  async list(companyCode: string, query: ListFeFacturasQuery) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const skip = (query.page - 1) * query.pageSize;
    const result = await this.facturaRepo.list({
      empresaId: empresa.id,
      estado: query.estado,
      tipoDocumento: query.tipoDocumento,
      skip,
      take: query.pageSize,
    });
    return {
      ...result,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(result.total / query.pageSize),
    };
  }

  /** Resumen de ventas (y NC/ND) por tarifa IVA para declaración. */
  async resumenIva(companyCode: string, desde: Date, hasta: Date) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const desdeNorm = startOfDay(desde);
    const hastaNorm = endOfDay(hasta);
    if (desdeNorm > hastaNorm) {
      throw new FeDomainError("Rango de fechas inválido", "FE_FECHA_RANGO_INVALIDO", 400);
    }

    const [facturas, notasCredito, notasDebito] = await Promise.all([
      this.prisma.feFactura.findMany({
        where: {
          empresaId: empresa.id,
          ...notDeleted,
          fecha: { gte: desdeNorm, lte: hastaNorm },
          estado: { in: [...ESTADOS_ACEPTADOS] },
        },
        select: {
          id: true,
          detalles: {
            where: notDeleted,
            select: {
              cantidad: true,
              precioUnitario: true,
              montoDescuento: true,
              codigoImpuesto: true,
              tarifaImpuesto: true,
              montoImpuesto: true,
            },
          },
        },
      }),
      this.prisma.feNotaCredito.findMany({
        where: {
          ...notDeleted,
          referenciaTipo: "FACTURA_VENTA",
          estado: { in: [...ESTADOS_ACEPTADOS] },
          facturaReferencia: {
            empresaId: empresa.id,
            ...notDeleted,
          },
          OR: [
            { comprobante: { fechaEmision: { gte: desdeNorm, lte: hastaNorm } } },
            { comprobanteId: null, createdAt: { gte: desdeNorm, lte: hastaNorm } },
          ],
        },
        select: {
          detalles: {
            where: notDeleted,
            select: {
              cantidad: true,
              precioUnitario: true,
              montoDescuento: true,
              codigoImpuesto: true,
              tarifaImpuesto: true,
              montoImpuesto: true,
            },
          },
        },
      }),
      this.prisma.feNotaDebito.findMany({
        where: {
          ...notDeleted,
          referenciaTipo: "FACTURA_VENTA",
          estado: { in: [...ESTADOS_ACEPTADOS] },
          facturaReferencia: {
            empresaId: empresa.id,
            ...notDeleted,
          },
          OR: [
            { comprobante: { fechaEmision: { gte: desdeNorm, lte: hastaNorm } } },
            { comprobanteId: null, createdAt: { gte: desdeNorm, lte: hastaNorm } },
          ],
        },
        select: {
          detalles: {
            where: notDeleted,
            select: {
              cantidad: true,
              precioUnitario: true,
              montoDescuento: true,
              codigoImpuesto: true,
              tarifaImpuesto: true,
              montoImpuesto: true,
            },
          },
        },
      }),
    ]);

    const map = new Map<string, IvaAggRow>();

    for (const f of facturas) {
      for (const d of f.detalles) {
        const row = lineBaseAndIva(d);
        if (row.montoBase <= 0 && row.montoImpuesto <= 0) continue;
        accumulateIva(map, { ...row, sign: 1 });
      }
    }
    for (const n of notasCredito) {
      for (const d of n.detalles) {
        const row = lineBaseAndIva(d);
        if (row.montoBase <= 0 && row.montoImpuesto <= 0) continue;
        accumulateIva(map, { ...row, sign: -1 });
      }
    }
    for (const n of notasDebito) {
      for (const d of n.detalles) {
        const row = lineBaseAndIva(d);
        if (row.montoBase <= 0 && row.montoImpuesto <= 0) continue;
        accumulateIva(map, { ...row, sign: 1 });
      }
    }

    const ivaPorTarifa = [...map.values()]
      .map((row) => ({
        ...row,
        montoBase: Math.round(row.montoBase * 100000) / 100000,
        montoImpuesto: Math.round(row.montoImpuesto * 100000) / 100000,
      }))
      .filter((row) => Math.abs(row.montoBase) > 0.00001 || Math.abs(row.montoImpuesto) > 0.00001)
      .sort((a, b) => a.tarifaPercent - b.tarifaPercent || a.codigoTarifaIVA.localeCompare(b.codigoTarifaIVA));

    return {
      desde: desdeNorm.toISOString(),
      hasta: hastaNorm.toISOString(),
      cantidadFacturas: facturas.length,
      cantidadNotasCredito: notasCredito.length,
      cantidadNotasDebito: notasDebito.length,
      ivaPorTarifa,
    };
  }

  private async assertPuntoVentaBelongsToEmpresa(puntoVentaId: string, empresaId: string) {
    const pv = await this.prisma.fePuntoVenta.findFirst({
      where: {
        id: puntoVentaId,
        ...notDeleted,
        sucursal: { empresaId, ...notDeleted },
      },
    });
    if (!pv) {
      throw new FeDomainError("Punto de venta inválido para la empresa", "FE_PUNTO_VENTA_INVALIDO");
    }
  }

  /** Valida vínculo manual con facturación mensual (sin sync automático). */
  private async assertFacturaMensualLinkable(facturaMensualId: string, companyCode: string) {
    const fm = await this.prisma.facturaMensual.findUnique({
      where: { id: facturaMensualId },
      include: { contract: { select: { company: true } } },
    });
    if (!fm) {
      throw new FeDomainError("Factura mensual ERP no encontrada", "FE_FACTURA_MENSUAL_NOT_FOUND");
    }
    if (fm.contract.company !== companyCode) {
      throw new FeDomainError(
        "La factura mensual no pertenece a la misma empresa",
        "FE_FACTURA_MENSUAL_COMPANY_MISMATCH"
      );
    }
  }
}
