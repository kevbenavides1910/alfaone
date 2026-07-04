import type { FeComprobanteTipo, PrismaClient } from "@prisma/client";
import { FeDomainError, FeNotFoundError } from "../errors/fe-errors";
import { notDeleted } from "../utils/soft-delete";
import type {
  CreateFeSucursalInput,
  UpdateFeSucursalInput,
} from "../validators/empresa.schema";

export class FeSucursalRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listByEmpresa(empresaId: string) {
    return this.prisma.feSucursal.findMany({
      where: { empresaId, ...notDeleted },
      orderBy: { codigo: "asc" },
      include: {
        puntosVenta: {
          where: notDeleted,
          orderBy: { codigo: "asc" },
          include: {
            consecutivos: { where: notDeleted },
          },
        },
      },
    });
  }

  async findById(id: string, empresaId: string) {
    const row = await this.prisma.feSucursal.findFirst({
      where: { id, empresaId, ...notDeleted },
    });
    if (!row) throw new FeNotFoundError("Sucursal no encontrada");
    return row;
  }

  async create(empresaId: string, input: CreateFeSucursalInput, userId?: string) {
    try {
      return await this.prisma.feSucursal.create({
        data: {
          empresaId,
          codigo: input.codigo,
          nombre: input.nombre,
          telefono: input.telefono ?? undefined,
          direccion: input.direccion ?? undefined,
          createdById: userId,
          updatedById: userId,
        },
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new FeDomainError(
          `Ya existe la sucursal ${input.codigo}`,
          "FE_SUCURSAL_DUPLICADA"
        );
      }
      throw e;
    }
  }

  update(id: string, input: UpdateFeSucursalInput, userId?: string) {
    return this.prisma.feSucursal.update({
      where: { id },
      data: { ...input, updatedById: userId },
    });
  }

  softDelete(id: string, userId?: string) {
    return this.prisma.feSucursal.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedById: userId },
    });
  }
}

function isUniqueError(e: unknown) {
  return typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "P2002";
}

export class FePuntoVentaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, empresaId: string) {
    const row = await this.prisma.fePuntoVenta.findFirst({
      where: {
        id,
        ...notDeleted,
        sucursal: { empresaId, ...notDeleted },
      },
      include: { sucursal: true, consecutivos: { where: notDeleted } },
    });
    if (!row) throw new FeNotFoundError("Punto de venta no encontrado");
    return row;
  }

  async create(
    sucursalId: string,
    input: { codigo: string; nombre: string },
    consecutivoTipos: FeComprobanteTipo[],
    userId?: string
  ) {
    try {
      return await this.prisma.fePuntoVenta.create({
        data: {
          sucursalId,
          codigo: input.codigo,
          nombre: input.nombre,
          createdById: userId,
          updatedById: userId,
          consecutivos: {
            create: consecutivoTipos.map((tipoComprobante) => ({ tipoComprobante })),
          },
        },
        include: { consecutivos: true, sucursal: true },
      });
    } catch (e) {
      if (isUniqueError(e)) {
        throw new FeDomainError(
          `Ya existe el terminal ${input.codigo} en esta sucursal`,
          "FE_PUNTO_VENTA_DUPLICADO"
        );
      }
      throw e;
    }
  }

  update(id: string, data: { codigo?: string; nombre?: string; isActive?: boolean }, userId?: string) {
    return this.prisma.fePuntoVenta.update({
      where: { id },
      data: { ...data, updatedById: userId },
    });
  }

  softDelete(id: string, userId?: string) {
    return this.prisma.fePuntoVenta.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false, updatedById: userId },
    });
  }
}

export class FeConsecutivoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /** Reserva el siguiente consecutivo con bloqueo optimista (reintento). */
  async nextNumero(puntoVentaId: string, tipo: FeComprobanteTipo, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
      const row = await this.prisma.feConsecutivo.findFirst({
        where: { puntoVentaId, tipoComprobante: tipo, ...notDeleted },
      });
      if (!row) throw new FeNotFoundError("Consecutivo no configurado para este terminal");

      const next = row.ultimoNumero + BigInt(1);
      const updated = await this.prisma.feConsecutivo.updateMany({
        where: { id: row.id, version: row.version, ...notDeleted },
        data: { ultimoNumero: next, version: { increment: 1 } },
      });
      if (updated.count === 1) return next;
    }
    throw new FeDomainError("No se pudo reservar consecutivo", "FE_CONSECUTIVO_CONFLICTO", 409);
  }
}
