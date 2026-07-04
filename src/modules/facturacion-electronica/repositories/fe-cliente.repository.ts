import type { PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";
import type { CreateFeClienteInput } from "../validators/cliente.schema";
import { FeNotFoundError } from "../errors/fe-errors";

export class FeClienteRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(empresaId: string, input: CreateFeClienteInput, userId?: string) {
    return this.prisma.feCliente.create({
      data: {
        empresaId,
        ...input,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  async findById(id: string, empresaId: string) {
    const row = await this.prisma.feCliente.findFirst({
      where: { id, empresaId, ...notDeleted },
    });
    if (!row) throw new FeNotFoundError("Cliente FE no encontrado");
    return row;
  }

  async list(empresaId: string) {
    return this.prisma.feCliente.findMany({
      where: { empresaId, ...notDeleted },
      orderBy: { nombre: "asc" },
    });
  }

  async update(id: string, empresaId: string, input: Partial<CreateFeClienteInput>, userId?: string) {
    await this.findById(id, empresaId);
    return this.prisma.feCliente.update({
      where: { id },
      data: { ...input, updatedById: userId },
    });
  }
}
