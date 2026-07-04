import type { FeComprobanteRecibidoEstado, Prisma, PrismaClient } from "@prisma/client";
import { notDeleted } from "../utils/soft-delete";

const includeMensaje = {
  mensajeReceptor: {
    include: {
      comprobante: {
        select: {
          id: true,
          consecutivo: true,
          claveNumerica: true,
          estadoHaciendaActual: true,
        },
      },
    },
  },
} satisfies Prisma.FeComprobanteRecibidoInclude;

export class FeComprobanteRecibidoRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(data: Prisma.FeComprobanteRecibidoCreateInput) {
    return this.prisma.feComprobanteRecibido.create({ data, include: includeMensaje });
  }

  /**
   * Upsert por la clave compuesta (empresaId, clave). Idempotente para
   * ingesta de IMAP: evita violación de restricción única cuando dos
   * corridas concurrentes intentan insertar el mismo comprobante.
   */
  async upsertByClave(
    empresaId: string,
    clave: string,
    create: Prisma.FeComprobanteRecibidoCreateInput,
  ) {
    return this.prisma.feComprobanteRecibido.upsert({
      where: { empresaId_clave: { empresaId, clave } },
      create,
      update: {}, // no-op si ya existe
      include: includeMensaje,
    });
  }

  findById(id: string, empresaId: string) {
    return this.prisma.feComprobanteRecibido.findFirst({
      where: { id, empresaId, ...notDeleted },
      include: includeMensaje,
    });
  }

  findByClave(empresaId: string, clave: string) {
    return this.prisma.feComprobanteRecibido.findFirst({
      where: { empresaId, clave, ...notDeleted },
    });
  }

  findByEmailMessageId(empresaId: string, emailMessageId: string) {
    return this.prisma.feComprobanteRecibido.findFirst({
      where: { empresaId, emailMessageId, ...notDeleted },
    });
  }

  list(empresaId: string, estado?: FeComprobanteRecibidoEstado) {
    return this.prisma.feComprobanteRecibido.findMany({
      where: {
        empresaId,
        ...notDeleted,
        ...(estado ? { estado } : {}),
      },
      include: includeMensaje,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  update(id: string, data: Prisma.FeComprobanteRecibidoUpdateInput) {
    return this.prisma.feComprobanteRecibido.update({
      where: { id },
      data,
      include: includeMensaje,
    });
  }

  listAllActive(empresaId: string) {
    return this.prisma.feComprobanteRecibido.findMany({
      where: { empresaId, ...notDeleted },
      select: {
        id: true,
        estado: true,
        clave: true,
        cedulaEmisor: true,
        xmlPath: true,
        parsedJson: true,
        emailSubject: true,
      },
    });
  }

  softDeleteMany(ids: string[], userId?: string) {
    if (!ids.length) return Promise.resolve({ count: 0 });
    return this.prisma.feComprobanteRecibido.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), updatedById: userId },
    });
  }
}
