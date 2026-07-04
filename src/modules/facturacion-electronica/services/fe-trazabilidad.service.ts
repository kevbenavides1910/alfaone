import type {
  FeEstadoHaciendaCodigo,
  FeHistorialEnvioOperacion,
  FeHistorialEnvioResultado,
  PrismaClient,
} from "@prisma/client";
import { randomUUID } from "crypto";

export class FeTrazabilidadService {
  constructor(private readonly prisma: PrismaClient) {}

  async log(params: {
    comprobanteId: string;
    operacion: FeHistorialEnvioOperacion;
    resultado: FeHistorialEnvioResultado;
    intento?: number;
    httpStatus?: number;
    duracionMs?: number;
    requestMeta?: unknown;
    responseMeta?: unknown;
    errorCode?: string;
    errorMessage?: string;
    correlationId?: string;
  }) {
    return this.prisma.feHistorialEnvio.create({
      data: {
        comprobanteId: params.comprobanteId,
        operacion: params.operacion,
        resultado: params.resultado,
        intento: params.intento ?? 1,
        httpStatus: params.httpStatus,
        duracionMs: params.duracionMs,
        requestMeta: params.requestMeta ? JSON.stringify(params.requestMeta) : undefined,
        responseMeta: params.responseMeta ? JSON.stringify(params.responseMeta) : undefined,
        errorCode: params.errorCode,
        errorMessage: params.errorMessage,
        correlationId: params.correlationId ?? randomUUID(),
      },
    });
  }

  async registrarEstadoHacienda(params: {
    comprobanteId: string;
    estado: FeEstadoHaciendaCodigo;
    mensaje?: string;
    detalle?: string;
    codigoRespuesta?: string;
  }) {
    await this.prisma.$transaction([
      this.prisma.feEstadoHacienda.create({
        data: {
          comprobanteId: params.comprobanteId,
          estado: params.estado,
          mensaje: params.mensaje,
          detalle: params.detalle,
          codigoRespuesta: params.codigoRespuesta,
        },
      }),
      this.prisma.feComprobanteElectronico.update({
        where: { id: params.comprobanteId },
        data: {
          estadoHaciendaActual: params.estado,
          mensajeHacienda: params.mensaje,
          detalleHacienda: params.detalle,
        },
      }),
    ]);
  }
}
