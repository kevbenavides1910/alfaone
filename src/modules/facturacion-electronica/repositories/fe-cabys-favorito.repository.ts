import type { PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";
import type { CreateFeCabysFavoritoInput } from "../validators/cabys-favorito.schema";

const MAX_FAVORITOS = 30;

export class FeCabysFavoritoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list(empresaId: string) {
    return this.prisma.feCabysFavorito.findMany({
      where: { empresaId, ...notDeleted },
      orderBy: [{ orden: "asc" }, { descripcion: "asc" }],
    });
  }

  findByCodigo(empresaId: string, codigo: string) {
    return this.prisma.feCabysFavorito.findFirst({
      where: { empresaId, codigo, ...notDeleted },
    });
  }

  async upsert(empresaId: string, input: CreateFeCabysFavoritoInput, userId?: string) {
    const existing = await this.prisma.feCabysFavorito.findFirst({
      where: { empresaId, codigo: input.codigo },
    });

    if (existing) {
      if (existing.deletedAt) {
        return this.prisma.feCabysFavorito.update({
          where: { id: existing.id },
          data: {
            descripcion: input.descripcion.trim(),
            impuesto: input.impuesto ?? null,
            deletedAt: null,
            updatedById: userId,
          },
        });
      }
      return this.prisma.feCabysFavorito.update({
        where: { id: existing.id },
        data: {
          descripcion: input.descripcion.trim(),
          impuesto: input.impuesto ?? null,
          updatedById: userId,
        },
      });
    }

    const count = await this.prisma.feCabysFavorito.count({
      where: { empresaId, ...notDeleted },
    });
    if (count >= MAX_FAVORITOS) {
      throw new Error(`Máximo ${MAX_FAVORITOS} favoritos CABYS por empresa`);
    }

    return this.prisma.feCabysFavorito.create({
      data: {
        empresaId,
        codigo: input.codigo,
        descripcion: input.descripcion.trim().slice(0, 200),
        impuesto: input.impuesto ?? null,
        orden: count,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  softDelete(id: string, empresaId: string, userId?: string) {
    return this.prisma.feCabysFavorito.updateMany({
      where: { id, empresaId, ...notDeleted },
      data: { deletedAt: new Date(), updatedById: userId },
    });
  }

  softDeleteByCodigo(empresaId: string, codigo: string, userId?: string) {
    return this.prisma.feCabysFavorito.updateMany({
      where: { empresaId, codigo, ...notDeleted },
      data: { deletedAt: new Date(), updatedById: userId },
    });
  }
}
