import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeClienteRepository } from "../repositories/fe-cliente.repository";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeFacturaRepository } from "../repositories/fe-factura.repository";
import type { CreateFeFacturaInput, ListFeFacturasQuery } from "../validators/factura.schema";
import { notDeleted } from "../utils/soft-delete";

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
