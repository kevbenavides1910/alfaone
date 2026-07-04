import type { PrismaClient } from "@prisma/client";
import { FeClienteRepository } from "../repositories/fe-cliente.repository";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import type { CreateFeClienteInput, UpdateFeClienteInput } from "../validators/cliente.schema";
import { toTribuCodigo } from "../utils/hacienda-actividad";

export class FeClienteService {
  private readonly repo: FeClienteRepository;
  private readonly empresaRepo: FeEmpresaRepository;

  constructor(prisma: PrismaClient) {
    this.repo = new FeClienteRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
  }

  async create(companyCode: string, input: CreateFeClienteInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const actividad = input.actividadEconomica?.trim() ? toTribuCodigo(input.actividadEconomica) : undefined;
    return this.repo.create(
      empresa.id,
      { ...input, ...(actividad ? { actividadEconomica: actividad } : {}) },
      userId
    );
  }

  async list(companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    return this.repo.list(empresa.id);
  }

  async update(companyCode: string, clienteId: string, input: UpdateFeClienteInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const actividad = input.actividadEconomica?.trim() ? toTribuCodigo(input.actividadEconomica) : undefined;
    const data: Partial<CreateFeClienteInput> = {
      ...input,
      ...(actividad !== undefined ? { actividadEconomica: actividad || undefined } : {}),
    };
    return this.repo.update(clienteId, empresa.id, data, userId);
  }
}
