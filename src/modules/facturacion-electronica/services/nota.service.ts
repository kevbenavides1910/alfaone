import type { PrismaClient } from "@prisma/client";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeNotaRepository } from "../repositories/fe-nota.repository";
import type { CreateFeNotaInput } from "../validators/nota.schema";
import { notDeleted } from "../utils/soft-delete";
import { codigoReferenciaPermitidoEnNota } from "../constants/hacienda-catalogos";
import { feTipoDocReferenciaFromComprobante } from "../constants/tipos-comprobante";
import type { FeNotaReferenciaResuelta } from "../utils/fe-nota-referencia";

const ESTADOS_REFERENCIA_OK = new Set(["ACEPTADA", "ACEPTADA_PARCIALMENTE"]);
const ESTADOS_NC_QUE_NO_SUMAN = ["RECHAZADA", "ANULADA", "ERROR"] as const;

export class FeNotaService {
  private readonly notaRepo: FeNotaRepository;
  private readonly empresaRepo: FeEmpresaRepository;

  constructor(private readonly prisma: PrismaClient) {
    this.notaRepo = new FeNotaRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
  }

  async createCredito(companyCode: string, input: CreateFeNotaInput, userId?: string) {
    this.assertCodigoReferencia(input, "credito");
    const ref = await this.assertDocumentoReferencia(companyCode, input);
    await this.assertTopeNotaCredito(input, ref.totalReferencia);
    return this.notaRepo.createCredito(ref, input, userId);
  }

  async createDebito(companyCode: string, input: CreateFeNotaInput, userId?: string) {
    this.assertCodigoReferencia(input, "debito");
    const ref = await this.assertDocumentoReferencia(companyCode, input);
    return this.notaRepo.createDebito(ref, input, userId);
  }

  getCreditoById(companyCode: string, id: string) {
    return this.empresaRepo.findByCompanyCode(companyCode).then((empresa) =>
      this.notaRepo.findCreditoById(id, empresa.id)
    );
  }

  getDebitoById(companyCode: string, id: string) {
    return this.empresaRepo.findByCompanyCode(companyCode).then((empresa) =>
      this.notaRepo.findDebitoById(id, empresa.id)
    );
  }

  private assertCodigoReferencia(input: CreateFeNotaInput, tipo: "credito" | "debito") {
    const error = codigoReferenciaPermitidoEnNota(input.codigoReferencia, tipo);
    if (error) throw new FeDomainError(error, "FE_CODIGO_REFERENCIA_INVALIDO", 400);
  }

  private async assertTopeNotaCredito(input: CreateFeNotaInput, totalReferencia: number) {
    const refWhere = input.facturaReferenciaId
      ? { facturaReferenciaId: input.facturaReferenciaId }
      : input.facturaCompraReferenciaId
        ? { facturaCompraReferenciaId: input.facturaCompraReferenciaId }
        : { reciboPagoReferenciaId: input.reciboPagoReferenciaId! };
    const where = { ...refWhere, ...notDeleted, estado: { notIn: [...ESTADOS_NC_QUE_NO_SUMAN] } };
    const [creditos, debitos] = await Promise.all([
      this.prisma.feNotaCredito.aggregate({ where, _sum: { total: true } }),
      this.prisma.feNotaDebito.aggregate({ where, _sum: { total: true } }),
    ]);
    const yaAcreditado = Number(creditos._sum.total ?? 0);
    const notasDebito = Number(debitos._sum.total ?? 0);
    const tope = totalReferencia + notasDebito;
    if (yaAcreditado + input.total > tope + 0.02) {
      throw new FeDomainError(
        `La nota de crédito supera el saldo del comprobante. Tope ${tope.toFixed(2)} (documento ${totalReferencia.toFixed(2)} + notas de débito ${notasDebito.toFixed(2)}); ya acreditado ${yaAcreditado.toFixed(2)}.`,
        "FE_NC_EXCEDE_SALDO",
        400
      );
    }
  }

  private async assertDocumentoReferencia(
    companyCode: string,
    input: CreateFeNotaInput
  ): Promise<FeNotaReferenciaResuelta> {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);

    if (input.referenciaTipo === "FACTURA_VENTA" && input.facturaReferenciaId) {
      const factura = await this.prisma.feFactura.findFirst({
        where: {
          id: input.facturaReferenciaId,
          empresaId: empresa.id,
          ...notDeleted,
        },
        include: { comprobante: true },
      });
      if (!factura) {
        throw new FeDomainError("Factura de referencia no encontrada", "FE_FACTURA_NOT_FOUND", 404);
      }
      if (!ESTADOS_REFERENCIA_OK.has(factura.estado)) {
        throw new FeDomainError(
          "La factura de referencia debe estar aceptada por Hacienda",
          "FE_FACTURA_REF_NO_ACEPTADA"
        );
      }
      if (!factura.comprobante?.claveNumerica) {
        throw new FeDomainError("La factura de referencia no tiene clave numérica", "FE_SIN_CLAVE_REF");
      }
      return {
        claveReferencia: factura.comprobante.claveNumerica,
        tipoDocReferencia: feTipoDocReferenciaFromComprobante(factura.tipoDocumento),
        totalReferencia: Number(factura.total),
      };
    }

    if (input.referenciaTipo === "FACTURA_COMPRA" && input.facturaCompraReferenciaId) {
      const compra = await this.prisma.feFacturaCompra.findFirst({
        where: {
          id: input.facturaCompraReferenciaId,
          empresaId: empresa.id,
          ...notDeleted,
        },
        include: { comprobante: true },
      });
      if (!compra) {
        throw new FeDomainError("Factura de compra no encontrada", "FE_FACTURA_NOT_FOUND", 404);
      }
      if (!ESTADOS_REFERENCIA_OK.has(compra.estado)) {
        throw new FeDomainError(
          "La factura de compra debe estar aceptada por Hacienda",
          "FE_FACTURA_REF_NO_ACEPTADA"
        );
      }
      if (!compra.comprobante?.claveNumerica) {
        throw new FeDomainError("La factura de compra no tiene clave numérica", "FE_SIN_CLAVE_REF");
      }
      return {
        claveReferencia: compra.comprobante.claveNumerica,
        tipoDocReferencia: feTipoDocReferenciaFromComprobante("FACTURA_ELECTRONICA_COMPRA"),
        totalReferencia: Number(compra.total),
      };
    }

    if (input.referenciaTipo === "RECIBO_PAGO" && input.reciboPagoReferenciaId) {
      const recibo = await this.prisma.feReciboPago.findFirst({
        where: {
          id: input.reciboPagoReferenciaId,
          empresaId: empresa.id,
          ...notDeleted,
        },
        include: { comprobante: true },
      });
      if (!recibo) {
        throw new FeDomainError("Recibo de pago no encontrado", "FE_FACTURA_NOT_FOUND", 404);
      }
      if (!ESTADOS_REFERENCIA_OK.has(recibo.estado)) {
        throw new FeDomainError(
          "El recibo de pago debe estar aceptado por Hacienda",
          "FE_FACTURA_REF_NO_ACEPTADA"
        );
      }
      if (!recibo.comprobante?.claveNumerica) {
        throw new FeDomainError("El recibo de pago no tiene clave numérica", "FE_SIN_CLAVE_REF");
      }
      return {
        claveReferencia: recibo.comprobante.claveNumerica,
        tipoDocReferencia: feTipoDocReferenciaFromComprobante("RECIBO_ELECTRONICO_PAGO"),
        totalReferencia: Number(recibo.total),
      };
    }

    throw new FeDomainError("Documento de referencia inválido", "FE_NOTA_REF_INVALIDA", 400);
  }
}
