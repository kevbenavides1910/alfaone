import type { PrismaClient } from "@prisma/client";
import { FeEmpresaConfigService } from "../services/empresa-config.service";
import type {
  CreateFePuntoVentaInput,
  CreateFeSucursalInput,
  UpdateFePuntoVentaInput,
  UpdateFeSucursalInput,
  UpsertFeEmpresaInput,
} from "../validators/empresa.schema";
import type { TestFeCorreoInput, UpdateFeCorreoInput } from "../validators/correo.schema";
import type { TestFeAtvInput } from "../validators/atv.schema";
import type { TestFeImapInput, UpdateFeImapInput } from "../validators/imap.schema";

export class FeEmpresaConfigController {
  private readonly service: FeEmpresaConfigService;

  constructor(prisma: PrismaClient) {
    this.service = new FeEmpresaConfigService(prisma);
  }

  getConfig(companyCode: string) {
    return this.service.getFullConfig(companyCode);
  }

  upsertEmpresa(companyCode: string, input: UpsertFeEmpresaInput & { atvPasswordStg?: string }, userId?: string) {
    return this.service.upsertEmpresa(companyCode, input, userId);
  }

  uploadCertificado(
    companyCode: string,
    file: { name: string; buffer: Buffer },
    password: string,
    userId?: string,
    forAmbiente?: "STAGING" | "PRODUCCION"
  ) {
    return this.service.uploadCertificado(companyCode, file, password, userId, forAmbiente);
  }

  uploadLogo(companyCode: string, file: { buffer: Buffer; mime: string }, userId?: string) {
    return this.service.uploadLogo(companyCode, file, userId);
  }

  clearLogo(companyCode: string, userId?: string) {
    return this.service.clearLogo(companyCode, userId);
  }

  createSucursal(companyCode: string, input: CreateFeSucursalInput, userId?: string) {
    return this.service.createSucursal(companyCode, input, userId);
  }

  updateSucursal(
    companyCode: string,
    sucursalId: string,
    input: UpdateFeSucursalInput,
    userId?: string
  ) {
    return this.service.updateSucursal(companyCode, sucursalId, input, userId);
  }

  deleteSucursal(companyCode: string, sucursalId: string, userId?: string) {
    return this.service.deleteSucursal(companyCode, sucursalId, userId);
  }

  createPuntoVenta(
    companyCode: string,
    sucursalId: string,
    input: CreateFePuntoVentaInput,
    userId?: string
  ) {
    return this.service.createPuntoVenta(companyCode, sucursalId, input, userId);
  }

  updatePuntoVenta(
    companyCode: string,
    puntoVentaId: string,
    input: UpdateFePuntoVentaInput,
    userId?: string
  ) {
    return this.service.updatePuntoVenta(companyCode, puntoVentaId, input, userId);
  }

  deletePuntoVenta(companyCode: string, puntoVentaId: string, userId?: string) {
    return this.service.deletePuntoVenta(companyCode, puntoVentaId, userId);
  }

  updateCorreo(companyCode: string, input: UpdateFeCorreoInput, userId?: string) {
    return this.service.updateCorreo(companyCode, input, userId);
  }

  testCorreo(companyCode: string, input: TestFeCorreoInput) {
    return this.service.testCorreo(companyCode, input);
  }

  testAtv(companyCode: string, input: TestFeAtvInput) {
    return this.service.testAtv(companyCode, input);
  }

  updateImap(companyCode: string, input: UpdateFeImapInput, userId?: string) {
    return this.service.updateImap(companyCode, input, userId);
  }

  testImap(companyCode: string, input: TestFeImapInput) {
    return this.service.testImap(companyCode, input);
  }

  syncImap(companyCode: string) {
    return this.service.syncImap(companyCode);
  }
}
