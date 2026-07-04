import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeProveedorConfianzaRepository } from "../repositories/fe-proveedor-confianza.repository";
import type {
  CreateFeProveedorConfianzaInput,
  UpdateFeProveedorConfianzaInput,
} from "../validators/proveedor-confianza.schema";

export class FeProveedorConfianzaService {
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly repo: FeProveedorConfianzaRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.repo = new FeProveedorConfianzaRepository(prisma);
  }

  async list(companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    return this.repo.list(empresa.id);
  }

  async create(companyCode: string, input: CreateFeProveedorConfianzaInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    return this.repo.create(empresa.id, input, userId);
  }

  async update(companyCode: string, id: string, input: UpdateFeProveedorConfianzaInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const result = await this.repo.update(id, empresa.id, { ...input, updatedById: userId });
    if (result.count === 0) {
      throw new FeDomainError("Proveedor no encontrado", "FE_PROVEEDOR_NOT_FOUND", 404);
    }
    return this.repo.list(empresa.id);
  }

  async remove(companyCode: string, id: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const result = await this.repo.softDelete(id, empresa.id, userId);
    if (result.count === 0) {
      throw new FeDomainError("Proveedor no encontrado", "FE_PROVEEDOR_NOT_FOUND", 404);
    }
    return { ok: true as const };
  }
}
