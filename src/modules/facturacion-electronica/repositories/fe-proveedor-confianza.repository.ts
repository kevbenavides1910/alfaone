import type { Prisma, PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";
import type { CreateFeProveedorConfianzaInput } from "../validators/proveedor-confianza.schema";

export class FeProveedorConfianzaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(empresaId: string, input: CreateFeProveedorConfianzaInput, userId?: string) {
    const cedula = input.cedula.replace(/\D/g, "");
    return this.prisma.feProveedorConfianza.create({
      data: {
        empresaId,
        cedula,
        nombre: input.nombre?.trim() || null,
        autoAceptar: input.autoAceptar,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  list(empresaId: string) {
    return this.prisma.feProveedorConfianza.findMany({
      where: { empresaId, ...notDeleted },
      orderBy: { nombre: "asc" },
    });
  }

  findActiveByCedula(empresaId: string, cedula: string) {
    const normalized = cedula.replace(/\D/g, "");
    return this.prisma.feProveedorConfianza.findFirst({
      where: {
        empresaId,
        cedula: normalized,
        isActive: true,
        autoAceptar: true,
        ...notDeleted,
      },
    });
  }

  update(id: string, empresaId: string, data: Prisma.FeProveedorConfianzaUpdateInput) {
    return this.prisma.feProveedorConfianza.updateMany({
      where: { id, empresaId, ...notDeleted },
      data,
    });
  }

  softDelete(id: string, empresaId: string, userId?: string) {
    return this.prisma.feProveedorConfianza.updateMany({
      where: { id, empresaId, ...notDeleted },
      data: { deletedAt: new Date(), updatedById: userId },
    });
  }
}
