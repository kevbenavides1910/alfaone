import { readFile } from "fs/promises";
import type { PrismaClient } from "@prisma/client";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { FeDomainError, FeNotFoundError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import { FeFacturaCompraRepository } from "../repositories/fe-factura-compra.repository";
import { FeFacturaRepository } from "../repositories/fe-factura.repository";
import { FeNotaRepository } from "../repositories/fe-nota.repository";
import { FeReciboPagoRepository } from "../repositories/fe-recibo-pago.repository";
import { FePdfService } from "./pdf/pdf.service";
import { FE_STORAGE_ROOT } from "../utils/fe-storage";
import { notDeleted } from "../utils/soft-delete";

export class FeAdjuntosDownloadService {
  private readonly facturaRepo: FeFacturaRepository;
  private readonly compraRepo: FeFacturaCompraRepository;
  private readonly reciboRepo: FeReciboPagoRepository;
  private readonly notaRepo: FeNotaRepository;
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly pdf: FePdfService;

  constructor(private readonly prisma: PrismaClient) {
    this.facturaRepo = new FeFacturaRepository(prisma);
    this.compraRepo = new FeFacturaCompraRepository(prisma);
    this.reciboRepo = new FeReciboPagoRepository(prisma);
    this.notaRepo = new FeNotaRepository(prisma);
    this.empresaRepo = new FeEmpresaRepository(prisma);
    this.pdf = new FePdfService(prisma);
  }

  async resolveFacturaPdf(facturaId: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const factura = await this.facturaRepo.findById(facturaId, empresa.id);
    if (!factura.comprobante) {
      throw new FeDomainError("La factura no tiene comprobante electrónico", "FE_SIN_COMPROBANTE");
    }

    let adjunto = await this.prisma.feAdjuntoPDF.findFirst({
      where: { comprobanteId: factura.comprobante.id, origen: "GENERADO", ...notDeleted },
      orderBy: { createdAt: "desc" },
    });

    if (!adjunto) {
      const generated = await this.pdf.generarFacturaPdf(factura.comprobante.id, companyCode);
      adjunto = await this.prisma.feAdjuntoPDF.findFirstOrThrow({
        where: { comprobanteId: factura.comprobante.id, storagePath: generated.storagePath },
      });
    }

    return this.readFileResponse(adjunto.storagePath, adjunto.fileName, adjunto.mimeType);
  }

  async resolveFacturaXml(facturaId: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const factura = await this.facturaRepo.findById(facturaId, empresa.id);
    return this.resolveComprobanteXml(factura.comprobante, "factura");
  }

  async resolveFacturaCompraPdf(id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.compraRepo.findById(id, empresa.id);
    if (!doc.comprobante) throw new FeDomainError("Sin comprobante", "FE_SIN_COMPROBANTE");

    let adjunto = await this.prisma.feAdjuntoPDF.findFirst({
      where: { comprobanteId: doc.comprobante.id, origen: "GENERADO", ...notDeleted },
      orderBy: { createdAt: "desc" },
    });
    if (!adjunto) {
      const generated = await this.pdf.generarFacturaCompraPdf(doc.comprobante.id, companyCode);
      adjunto = await this.prisma.feAdjuntoPDF.findFirstOrThrow({
        where: { comprobanteId: doc.comprobante.id, storagePath: generated.storagePath },
      });
    }
    return this.readFileResponse(adjunto.storagePath, adjunto.fileName, adjunto.mimeType);
  }

  async resolveFacturaCompraXml(id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.compraRepo.findById(id, empresa.id);
    return this.resolveComprobanteXml(doc.comprobante, "FEC");
  }

  async resolveReciboPagoPdf(id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.reciboRepo.findById(id, empresa.id);
    if (!doc.comprobante) throw new FeDomainError("Sin comprobante", "FE_SIN_COMPROBANTE");

    let adjunto = await this.prisma.feAdjuntoPDF.findFirst({
      where: { comprobanteId: doc.comprobante.id, origen: "GENERADO", ...notDeleted },
      orderBy: { createdAt: "desc" },
    });
    if (!adjunto) {
      const generated = await this.pdf.generarReciboPagoPdf(doc.comprobante.id, companyCode);
      adjunto = await this.prisma.feAdjuntoPDF.findFirstOrThrow({
        where: { comprobanteId: doc.comprobante.id, storagePath: generated.storagePath },
      });
    }
    return this.readFileResponse(adjunto.storagePath, adjunto.fileName, adjunto.mimeType);
  }

  async resolveReciboPagoXml(id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const doc = await this.reciboRepo.findById(id, empresa.id);
    return this.resolveComprobanteXml(doc.comprobante, "REP");
  }

  async resolveNotaCreditoPdf(id: string, companyCode: string) {
    return this.resolveNotaPdf("nota_credito", id, companyCode);
  }

  async resolveNotaCreditoXml(id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const nota = await this.notaRepo.findCreditoById(id, empresa.id);
    return this.resolveComprobanteXml(nota.comprobante, "NC");
  }

  async resolveNotaDebitoPdf(id: string, companyCode: string) {
    return this.resolveNotaPdf("nota_debito", id, companyCode);
  }

  async resolveNotaDebitoXml(id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const nota = await this.notaRepo.findDebitoById(id, empresa.id);
    return this.resolveComprobanteXml(nota.comprobante, "ND");
  }

  private async resolveNotaPdf(kind: "nota_credito" | "nota_debito", id: string, companyCode: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const nota =
      kind === "nota_credito"
        ? await this.notaRepo.findCreditoById(id, empresa.id)
        : await this.notaRepo.findDebitoById(id, empresa.id);
    if (!nota.comprobante) throw new FeDomainError("Sin comprobante", "FE_SIN_COMPROBANTE");

    let adjunto = await this.prisma.feAdjuntoPDF.findFirst({
      where: { comprobanteId: nota.comprobante.id, origen: "GENERADO", ...notDeleted },
      orderBy: { createdAt: "desc" },
    });
    if (!adjunto) {
      const generated =
        kind === "nota_credito"
          ? await this.pdf.generarNotaCreditoPdf(nota.comprobante.id, companyCode)
          : await this.pdf.generarNotaDebitoPdf(nota.comprobante.id, companyCode);
      adjunto = await this.prisma.feAdjuntoPDF.findFirstOrThrow({
        where: { comprobanteId: nota.comprobante.id, storagePath: generated.storagePath },
      });
    }
    return this.readFileResponse(adjunto.storagePath, adjunto.fileName, adjunto.mimeType);
  }

  private resolveComprobanteXml(
    comprobante: { consecutivo: string; xmlFirmadoPath?: string | null; xmlSinFirmaPath?: string | null } | null,
    prefix: string
  ) {
    if (!comprobante) {
      throw new FeDomainError("Sin comprobante electrónico", "FE_SIN_COMPROBANTE");
    }
    const relativePath = comprobante.xmlFirmadoPath ?? comprobante.xmlSinFirmaPath;
    if (!relativePath) {
      throw new FeDomainError("No hay XML disponible", "FE_SIN_XML");
    }
    const fileName = `${prefix}-${comprobante.consecutivo}${comprobante.xmlFirmadoPath ? "" : "-sin-firma"}.xml`;
    return this.readFileResponse(relativePath, fileName, "application/xml");
  }

  private async readFileResponse(relativePath: string, fileName: string, mimeType: string) {
    const abs = resolveUnderRoot(FE_STORAGE_ROOT, relativePath);
    if (!abs) throw new FeNotFoundError("Archivo no encontrado");

    const buf = await readFile(abs).catch(() => null);
    if (!buf) throw new FeNotFoundError("Archivo no encontrado");

    return { buf, fileName, mimeType };
  }
}
