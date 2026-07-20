import type { FeFacturaEstado, Prisma, PrismaClient } from "@prisma/client";
import { FeNotFoundError } from "../errors/fe-errors";
import { notDeleted } from "../utils/soft-delete";
import type { CreateFeMensajeReceptorInput } from "../validators/mensaje-receptor.schema";

const include = {
  comprobante: true,
  puntoVenta: { include: { sucursal: true } },
} satisfies Prisma.FeMensajeReceptorInclude;

export class FeMensajeReceptorRepository {
  constructor(private readonly prisma: PrismaClient) {}

  create(empresaId: string, input: CreateFeMensajeReceptorInput, userId?: string) {
    return this.prisma.feMensajeReceptor.create({
      data: {
        empresaId,
        puntoVentaId: input.puntoVentaId,
        claveComprobante: input.claveComprobante,
        cedulaEmisor: input.cedulaEmisor.replace(/\D/g, ""),
        tipoMensaje: input.tipoMensaje,
        detalleMensaje: input.detalleMensaje,
        montoTotalImpuesto: input.montoTotalImpuesto,
        montoTotal: input.montoTotal,
        createdById: userId,
        updatedById: userId,
      },
      include,
    });
  }

  /** Mensaje ya ligado a un comprobante recibido (reintentos tras ERROR de envío). */
  findByComprobanteRecibidoId(empresaId: string, comprobanteRecibidoId: string) {
    return this.prisma.feMensajeReceptor.findFirst({
      where: { empresaId, comprobanteRecibidoId, ...notDeleted },
      include,
    });
  }

  updateForRetry(
    id: string,
    data: {
      puntoVentaId?: string;
      claveComprobante?: string;
      cedulaEmisor?: string;
      tipoMensaje?: string;
      detalleMensaje?: string | null;
      montoTotal?: number | null;
      montoTotalImpuesto?: number | null;
      estado?: FeFacturaEstado;
    },
    userId?: string
  ) {
    return this.prisma.feMensajeReceptor.update({
      where: { id },
      data: {
        ...data,
        cedulaEmisor: data.cedulaEmisor?.replace(/\D/g, ""),
        updatedById: userId,
      },
      include,
    });
  }

  async findById(id: string, empresaId: string) {
    const row = await this.prisma.feMensajeReceptor.findFirst({
      where: { id, empresaId, ...notDeleted },
      include,
    });
    if (!row) throw new FeNotFoundError("Mensaje receptor no encontrado");
    return row;
  }

  list(empresaId: string, take = 50) {
    return this.prisma.feMensajeReceptor.findMany({
      where: { empresaId, ...notDeleted },
      orderBy: { createdAt: "desc" },
      take,
      include: {
        comprobante: { select: { consecutivo: true, claveNumerica: true, estadoHaciendaActual: true } },
      },
    });
  }

  updateEstado(id: string, estado: FeFacturaEstado, userId?: string) {
    return this.prisma.feMensajeReceptor.update({
      where: { id },
      data: { estado, updatedById: userId },
    });
  }
}

export { include as mensajeReceptorInclude };
