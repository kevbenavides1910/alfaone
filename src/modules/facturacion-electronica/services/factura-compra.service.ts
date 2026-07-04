import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeFacturaCompraRepository } from "../repositories/fe-factura-compra.repository";
import { FeReciboPagoRepository } from "../repositories/fe-recibo-pago.repository";
import { FeEmisionOrchestratorService } from "./emision-orchestrator.service";
import type { CreateFeFacturaCompraInput } from "../validators/compra.schema";
import { notDeleted } from "../utils/soft-delete";

export class FeFacturaCompraService {
  private readonly repo: FeFacturaCompraRepository;
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly emision: FeEmisionOrchestratorService;
  private readonly prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.repo = new FeFacturaCompraRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.emision = new FeEmisionOrchestratorService(prisma);
  }

  async create(companyCode: string, input: CreateFeFacturaCompraInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.assertPuntoVenta(input.puntoVentaId, empresa.id);
    return this.repo.create(empresa.id, input, userId);
  }

  getById(companyCode: string, id: string) {
    return this.empresaRepo.findByCompanyCode(companyCode).then((e) => this.repo.findById(id, e.id));
  }

  async list(companyCode: string, page = 1, pageSize = 20) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.repo.list({ empresaId: empresa.id, skip, take: pageSize });
    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  encolarEnvio(companyCode: string, id: string, userId?: string) {
    return this.emision.encolarEnvioFacturaCompra(companyCode, id, userId);
  }

  consultarEstado(companyCode: string, id: string) {
    return this.emision.consultarEstadoDocumento("factura_compra", id, companyCode);
  }

  private async assertPuntoVenta(puntoVentaId: string, empresaId: string) {
    const pv = await this.prisma.fePuntoVenta.findFirst({
      where: { id: puntoVentaId, ...notDeleted, sucursal: { empresaId, ...notDeleted } },
    });
    if (!pv) throw new FeDomainError("Punto de venta inválido", "FE_PUNTO_VENTA_INVALIDO");
  }
}
