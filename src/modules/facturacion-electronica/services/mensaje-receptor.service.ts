import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeMensajeReceptorRepository } from "../repositories/fe-mensaje-receptor.repository";
import type { CreateFeMensajeReceptorInput } from "../validators/mensaje-receptor.schema";
import { notDeleted } from "../utils/soft-delete";

export class FeMensajeReceptorService {
  private readonly repo: FeMensajeReceptorRepository;
  private readonly empresaRepo: FeEmpresaRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.repo = new FeMensajeReceptorRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
  }

  async create(companyCode: string, input: CreateFeMensajeReceptorInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.assertPuntoVenta(empresa.id, input.puntoVentaId);
    return this.repo.create(empresa.id, input, userId);
  }

  async getById(companyCode: string, id: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    return this.repo.findById(id, empresa.id);
  }

  async list(companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    return this.repo.list(empresa.id);
  }

  private async assertPuntoVenta(empresaId: string, puntoVentaId: string) {
    const pv = await this.prisma.fePuntoVenta.findFirst({
      where: { id: puntoVentaId, ...notDeleted, sucursal: { empresaId, ...notDeleted } },
    });
    if (!pv) {
      throw new FeDomainError("Punto de venta inválido", "FE_PUNTO_VENTA_INVALIDO");
    }
  }
}
