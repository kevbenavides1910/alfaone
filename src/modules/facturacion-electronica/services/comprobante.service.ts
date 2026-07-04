import type { FeComprobanteTipo, PrismaClient } from "@prisma/client";
import { FE_TIPO_COMPROBANTE_CODIGO } from "../constants/tipos-comprobante";
import { FeDomainError } from "../errors/fe-errors";
import { FeConsecutivoRepository, FePuntoVentaRepository } from "../repositories/fe-sucursal.repository";
import { formatFeConsecutivo, generateFeClaveNumerica, resolveClaveSituacion, type FeClaveSituacion } from "../utils/consecutivo-clave";
import { notDeleted } from "../utils/soft-delete";
import { notaEmpresaWhere } from "../utils/fe-nota-referencia";

export class FeComprobanteService {
  private readonly consecutivoRepo: FeConsecutivoRepository;
  private readonly puntoVentaRepo: FePuntoVentaRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.consecutivoRepo = new FeConsecutivoRepository(prisma);
    this.puntoVentaRepo = new FePuntoVentaRepository(prisma);
  }

  /** Reserva consecutivo y crea registro de comprobante para documento de venta (FE/TE/FEE). */
  async reservarDocumentoVenta(params: {
    facturaId: string;
    empresaId: string;
    tipo: Extract<
      import("@prisma/client").FeComprobanteTipo,
      "FACTURA_ELECTRONICA" | "TIQUETE_ELECTRONICO" | "FACTURA_ELECTRONICA_EXPORTACION"
    >;
    puntoVentaId: string;
    cedulaJuridica: string;
    fechaEmision: Date;
    claveSituacion?: FeClaveSituacion | string | null;
    ambiente?: "STAGING" | "PRODUCCION";
    userId?: string;
  }) {
    const factura = await this.prisma.feFactura.findFirst({
      where: { id: params.facturaId, empresaId: params.empresaId, ...notDeleted },
    });
    if (!factura) throw new FeDomainError("Factura no encontrada", "FE_FACTURA_NOT_FOUND", 404);
    if (factura.comprobanteId) {
      throw new FeDomainError("La factura ya tiene comprobante asociado", "FE_COMPROBANTE_YA_EXISTE");
    }

    const pv = await this.puntoVentaRepo.findById(params.puntoVentaId, params.empresaId);
    if (!pv.sucursal) throw new FeDomainError("Sucursal del terminal no encontrada");

    const tipo = params.tipo;
    const numero = await this.consecutivoRepo.nextNumero(params.puntoVentaId, tipo);
    const tipoCodigo = FE_TIPO_COMPROBANTE_CODIGO[tipo];
    const consecutivo = formatFeConsecutivo({
      sucursalCodigo: pv.sucursal.codigo,
      terminalCodigo: pv.codigo,
      tipoCodigo,
      numero,
    });
    const claveNumerica = generateFeClaveNumerica({
      fecha: params.fechaEmision,
      cedulaJuridica: params.cedulaJuridica,
      consecutivo,
      situacion: resolveClaveSituacion(params.claveSituacion, params.ambiente),
    });

    return this.prisma.$transaction(async (tx) => {
      const comprobante = await tx.feComprobanteElectronico.create({
        data: {
          empresaId: params.empresaId,
          puntoVentaId: params.puntoVentaId,
          tipo,
          claveNumerica,
          consecutivo,
          fechaEmision: params.fechaEmision,
          createdById: params.userId,
          updatedById: params.userId,
        },
      });

      await tx.feFactura.update({
        where: { id: params.facturaId },
        data: { comprobanteId: comprobante.id, updatedById: params.userId },
      });

      return comprobante;
    });
  }

  async reservarFacturaElectronica(params: {
    facturaId: string;
    empresaId: string;
    puntoVentaId: string;
    cedulaJuridica: string;
    fechaEmision: Date;
    claveSituacion?: FeClaveSituacion | string | null;
    ambiente?: "STAGING" | "PRODUCCION";
    userId?: string;
  }) {
    const factura = await this.prisma.feFactura.findFirst({
      where: { id: params.facturaId, empresaId: params.empresaId, ...notDeleted },
      select: { tipoDocumento: true },
    });
    const tipo =
      factura?.tipoDocumento === "TIQUETE_ELECTRONICO"
        ? "TIQUETE_ELECTRONICO"
        : factura?.tipoDocumento === "FACTURA_ELECTRONICA_EXPORTACION"
          ? "FACTURA_ELECTRONICA_EXPORTACION"
          : "FACTURA_ELECTRONICA";
    return this.reservarDocumentoVenta({ ...params, tipo });
  }

  async reservarFacturaCompra(params: {
    facturaCompraId: string;
    empresaId: string;
    puntoVentaId: string;
    cedulaJuridica: string;
    fechaEmision: Date;
    claveSituacion?: FeClaveSituacion | string | null;
    ambiente?: "STAGING" | "PRODUCCION";
    userId?: string;
  }) {
    const doc = await this.prisma.feFacturaCompra.findFirst({
      where: { id: params.facturaCompraId, empresaId: params.empresaId, ...notDeleted },
    });
    if (!doc) throw new FeDomainError("Factura de compra no encontrada", "FE_FACTURA_COMPRA_NOT_FOUND", 404);
    if (doc.comprobanteId) throw new FeDomainError("Ya tiene comprobante", "FE_COMPROBANTE_YA_EXISTE");

    const pv = await this.puntoVentaRepo.findById(params.puntoVentaId, params.empresaId);
    if (!pv.sucursal) throw new FeDomainError("Sucursal del terminal no encontrada");

    const tipo = "FACTURA_ELECTRONICA_COMPRA" as const;
    const numero = await this.consecutivoRepo.nextNumero(params.puntoVentaId, tipo);
    const consecutivo = formatFeConsecutivo({
      sucursalCodigo: pv.sucursal.codigo,
      terminalCodigo: pv.codigo,
      tipoCodigo: FE_TIPO_COMPROBANTE_CODIGO[tipo],
      numero,
    });
    const claveNumerica = generateFeClaveNumerica({
      fecha: params.fechaEmision,
      cedulaJuridica: params.cedulaJuridica,
      consecutivo,
      situacion: resolveClaveSituacion(params.claveSituacion, params.ambiente),
    });

    return this.prisma.$transaction(async (tx) => {
      const comprobante = await tx.feComprobanteElectronico.create({
        data: {
          empresaId: params.empresaId,
          puntoVentaId: params.puntoVentaId,
          tipo,
          claveNumerica,
          consecutivo,
          fechaEmision: params.fechaEmision,
          createdById: params.userId,
          updatedById: params.userId,
        },
      });
      await tx.feFacturaCompra.update({
        where: { id: params.facturaCompraId },
        data: { comprobanteId: comprobante.id, updatedById: params.userId },
      });
      return comprobante;
    });
  }

  async reservarReciboPago(params: {
    reciboId: string;
    empresaId: string;
    puntoVentaId: string;
    cedulaJuridica: string;
    fechaEmision: Date;
    claveSituacion?: FeClaveSituacion | string | null;
    ambiente?: "STAGING" | "PRODUCCION";
    userId?: string;
  }) {
    const doc = await this.prisma.feReciboPago.findFirst({
      where: { id: params.reciboId, empresaId: params.empresaId, ...notDeleted },
    });
    if (!doc) throw new FeDomainError("Recibo de pago no encontrado", "FE_RECIBO_NOT_FOUND", 404);
    if (doc.comprobanteId) throw new FeDomainError("Ya tiene comprobante", "FE_COMPROBANTE_YA_EXISTE");

    const pv = await this.puntoVentaRepo.findById(params.puntoVentaId, params.empresaId);
    if (!pv.sucursal) throw new FeDomainError("Sucursal del terminal no encontrada");

    const tipo = "RECIBO_ELECTRONICO_PAGO" as const;
    const numero = await this.consecutivoRepo.nextNumero(params.puntoVentaId, tipo);
    const consecutivo = formatFeConsecutivo({
      sucursalCodigo: pv.sucursal.codigo,
      terminalCodigo: pv.codigo,
      tipoCodigo: FE_TIPO_COMPROBANTE_CODIGO[tipo],
      numero,
    });
    const claveNumerica = generateFeClaveNumerica({
      fecha: params.fechaEmision,
      cedulaJuridica: params.cedulaJuridica,
      consecutivo,
      situacion: resolveClaveSituacion(params.claveSituacion, params.ambiente),
    });

    return this.prisma.$transaction(async (tx) => {
      const comprobante = await tx.feComprobanteElectronico.create({
        data: {
          empresaId: params.empresaId,
          puntoVentaId: params.puntoVentaId,
          tipo,
          claveNumerica,
          consecutivo,
          fechaEmision: params.fechaEmision,
          createdById: params.userId,
          updatedById: params.userId,
        },
      });
      await tx.feReciboPago.update({
        where: { id: params.reciboId },
        data: { comprobanteId: comprobante.id, updatedById: params.userId },
      });
      return comprobante;
    });
  }

  /** Reserva consecutivo y comprobante para nota crédito o débito. */
  async reservarNotaComprobante(params: {
    tipo: Extract<FeComprobanteTipo, "NOTA_CREDITO" | "NOTA_DEBITO">;
    notaId: string;
    empresaId: string;
    puntoVentaId: string;
    cedulaJuridica: string;
    fechaEmision: Date;
    claveSituacion?: FeClaveSituacion | string | null;
    ambiente?: "STAGING" | "PRODUCCION";
    userId?: string;
  }) {
    const nota =
      params.tipo === "NOTA_CREDITO"
        ? await this.prisma.feNotaCredito.findFirst({
            where: { id: params.notaId, ...notDeleted, ...notaEmpresaWhere(params.empresaId) },
          })
        : await this.prisma.feNotaDebito.findFirst({
            where: { id: params.notaId, ...notDeleted, ...notaEmpresaWhere(params.empresaId) },
          });
    if (!nota) throw new FeDomainError("Nota no encontrada", "FE_NOTA_NOT_FOUND", 404);
    if (nota.comprobanteId) {
      throw new FeDomainError("La nota ya tiene comprobante asociado", "FE_COMPROBANTE_YA_EXISTE");
    }

    const pv = await this.puntoVentaRepo.findById(params.puntoVentaId, params.empresaId);
    if (!pv.sucursal) throw new FeDomainError("Sucursal del terminal no encontrada");

    const numero = await this.consecutivoRepo.nextNumero(params.puntoVentaId, params.tipo);
    const tipoCodigo = FE_TIPO_COMPROBANTE_CODIGO[params.tipo];
    const consecutivo = formatFeConsecutivo({
      sucursalCodigo: pv.sucursal.codigo,
      terminalCodigo: pv.codigo,
      tipoCodigo,
      numero,
    });
    const claveNumerica = generateFeClaveNumerica({
      fecha: params.fechaEmision,
      cedulaJuridica: params.cedulaJuridica,
      consecutivo,
      situacion: resolveClaveSituacion(params.claveSituacion, params.ambiente),
    });

    return this.prisma.$transaction(async (tx) => {
      const comprobante = await tx.feComprobanteElectronico.create({
        data: {
          empresaId: params.empresaId,
          puntoVentaId: params.puntoVentaId,
          tipo: params.tipo,
          claveNumerica,
          consecutivo,
          fechaEmision: params.fechaEmision,
          createdById: params.userId,
          updatedById: params.userId,
        },
      });

      if (params.tipo === "NOTA_CREDITO") {
        await tx.feNotaCredito.update({
          where: { id: params.notaId },
          data: { comprobanteId: comprobante.id, updatedById: params.userId },
        });
      } else {
        await tx.feNotaDebito.update({
          where: { id: params.notaId },
          data: { comprobanteId: comprobante.id, updatedById: params.userId },
        });
      }

      return comprobante;
    });
  }

  async reservarMensajeReceptorComprobante(params: {
    mensajeId: string;
    empresaId: string;
    puntoVentaId: string;
    cedulaJuridica: string;
    fechaEmision: Date;
    claveSituacion?: FeClaveSituacion | string | null;
    ambiente?: "STAGING" | "PRODUCCION";
    userId?: string;
  }) {
    const mensaje = await this.prisma.feMensajeReceptor.findFirst({
      where: { id: params.mensajeId, empresaId: params.empresaId, ...notDeleted },
    });
    if (!mensaje) throw new FeDomainError("Mensaje receptor no encontrado", "FE_MENSAJE_NOT_FOUND", 404);
    if (mensaje.comprobanteId) {
      throw new FeDomainError("El mensaje ya tiene comprobante asociado", "FE_COMPROBANTE_YA_EXISTE");
    }

    const pv = await this.puntoVentaRepo.findById(params.puntoVentaId, params.empresaId);
    if (!pv.sucursal) throw new FeDomainError("Sucursal del terminal no encontrada");

    const tipo: FeComprobanteTipo = "MENSAJE_RECEPTOR";
    const numero = await this.consecutivoRepo.nextNumero(params.puntoVentaId, tipo);
    const tipoCodigo = FE_TIPO_COMPROBANTE_CODIGO[tipo];
    const consecutivo = formatFeConsecutivo({
      sucursalCodigo: pv.sucursal.codigo,
      terminalCodigo: pv.codigo,
      tipoCodigo,
      numero,
    });
    const claveNumerica = generateFeClaveNumerica({
      fecha: params.fechaEmision,
      cedulaJuridica: params.cedulaJuridica,
      consecutivo,
      situacion: resolveClaveSituacion(params.claveSituacion, params.ambiente),
    });

    return this.prisma.$transaction(async (tx) => {
      const comprobante = await tx.feComprobanteElectronico.create({
        data: {
          empresaId: params.empresaId,
          puntoVentaId: params.puntoVentaId,
          tipo,
          claveNumerica,
          consecutivo,
          fechaEmision: params.fechaEmision,
          createdById: params.userId,
          updatedById: params.userId,
        },
      });

      await tx.feMensajeReceptor.update({
        where: { id: params.mensajeId },
        data: { comprobanteId: comprobante.id, updatedById: params.userId },
      });

      return comprobante;
    });
  }
}
