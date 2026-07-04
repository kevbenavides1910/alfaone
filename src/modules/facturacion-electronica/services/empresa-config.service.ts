import { writeFile, mkdir } from "fs/promises";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { resolveUnderRoot } from "@/lib/security/path-safety";
import { FeDomainError } from "../errors/fe-errors";
import { FeEmpresaRepository } from "../repositories/fe-empresa.repository";
import {
  FeConsecutivoRepository,
  FePuntoVentaRepository,
  FeSucursalRepository,
} from "../repositories/fe-sucursal.repository";
import { encryptCertPassword } from "../utils/crypto-certificado";
import {
  ensureFeDir,
  feCertificadosDir,
  feLogosDir,
  feRelativePath,
  FE_STORAGE_ROOT,
} from "../utils/fe-storage";
import { serializeFeEmpresa, feSmtpSourceFromEmpresa } from "../utils/fe-empresa.serializer";
import { serializeFePuntoVenta, serializeFeSucursales } from "../utils/fe-sucursal.serializer";
import { isTribuAtvUsuario } from "../utils/fe-atv-usuario";
import { feSmtpConfigured } from "../services/mail/fe-smtp";
import { feImapConfigured, feImapSourceFromEmpresa } from "../services/mail/fe-imap";
import type { UpdateFeCorreoInput, TestFeCorreoInput } from "../validators/correo.schema";
import type { UpdateFeImapInput, TestFeImapInput } from "../validators/imap.schema";
import { FeIncomingMailService } from "../services/incoming/incoming-mail.service";
import { feCorreoService } from "../services/mail/correo.service";
import { feTokenHaciendaService } from "./hacienda/token-hacienda.service";
import type { TestFeAtvInput } from "../validators/atv.schema";
import { FE_CONSECUTIVO_TIPOS } from "../utils/consecutivo-clave";
import type {
  CreateFePuntoVentaInput,
  CreateFeSucursalInput,
  UpdateFePuntoVentaInput,
  UpdateFeSucursalInput,
  UpsertFeEmpresaInput,
} from "../validators/empresa.schema";

export class FeEmpresaConfigService {
  private readonly empresaRepo: FeEmpresaRepository;
  private readonly sucursalRepo: FeSucursalRepository;
  private readonly puntoVentaRepo: FePuntoVentaRepository;

  constructor(private readonly db: PrismaClient = prisma) {
    this.empresaRepo = new FeEmpresaRepository(db);
    this.sucursalRepo = new FeSucursalRepository(db);
    this.puntoVentaRepo = new FePuntoVentaRepository(db);
  }

  async getFullConfig(companyCode: string) {
    const empresa = await this.empresaRepo.findOptionalByCompanyCode(companyCode);
    if (!empresa) {
      const company = await this.db.company.findUnique({ where: { code: companyCode } });
      return {
        configured: false as const,
        company: company ? { code: company.code, name: company.name } : null,
        empresa: null,
        sucursales: [],
        readiness: {
          emisor: false,
          certificado: false,
          atv: false,
          sucursal: false,
          puntoVenta: false,
          readyToEmit: false,
        },
        smtpConfigured: false,
        imapConfigured: false,
      };
    }

    const sucursales = await this.sucursalRepo.listByEmpresa(empresa.id);
    const serialized = serializeFeEmpresa(empresa);
    const puntoVentaCount = sucursales.reduce((n, s) => n + s.puntosVenta.length, 0);
    const isStaging = serialized.ambiente === "STAGING";
    const readiness = {
      emisor: true,
      certificado: isStaging
        ? (serialized.hasCertificadoStg && serialized.hasCertificadoPasswordStg)
        : (serialized.hasCertificado && serialized.hasCertificadoPassword),
      atv: isStaging
        ? (serialized.hasAtvPasswordStg &&
            Boolean((serialized.atvUsuarioStg ?? serialized.atvUsuario)?.trim()) &&
            isTribuAtvUsuario(serialized.atvUsuarioStg ?? serialized.atvUsuario))
        : (serialized.hasAtvPassword && Boolean(serialized.atvUsuario?.trim())),
      sucursal: sucursales.length > 0,
      puntoVenta: puntoVentaCount > 0,
    };

    return {
      configured: true as const,
      company: { code: empresa.companyCode, name: empresa.nombreComercial },
      empresa: serialized,
      sucursales: serializeFeSucursales(sucursales),
      readiness: {
        ...readiness,
        readyToEmit: readiness.certificado && readiness.atv && readiness.sucursal && readiness.puntoVenta,
      },
      smtpConfigured: feSmtpConfigured(feSmtpSourceFromEmpresa(empresa)),
      imapConfigured: feImapConfigured(feImapSourceFromEmpresa(empresa)),
    };
  }

  async updateImap(companyCode: string, input: UpdateFeImapInput, userId?: string) {
    await this.db.company.findUniqueOrThrow({ where: { code: companyCode } });
    const empresa = await this.empresaRepo.findOptionalByCompanyCode(companyCode);
    if (!empresa) {
      throw new FeDomainError(
        "Guarde primero los datos del emisor antes de configurar IMAP",
        "FE_EMPRESA_NO_CONFIGURADA"
      );
    }
    if (input.imapEnabled && !input.imapPuntoVentaId) {
      throw new FeDomainError("Seleccione punto de venta para mensajes receptor", "FE_IMAP_PUNTO_VENTA", 400);
    }
    const updated = await this.empresaRepo.updateImap(companyCode, input, userId);
    return serializeFeEmpresa(updated);
  }

  async testImap(companyCode: string, input: TestFeImapInput) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const pass =
      input.imapPass === "use-stored" ? empresa.imapPass?.trim() : input.imapPass?.trim();
    if (!pass) {
      throw new FeDomainError("Indique la contraseña IMAP", "FE_IMAP_PASSWORD", 400);
    }
    const incoming = new FeIncomingMailService(this.db);
    return incoming.testConnection({ ...input, imapPass: pass });
  }

  async syncImap(companyCode: string) {
    const incoming = new FeIncomingMailService(this.db);
    return incoming.pollEmpresa(companyCode);
  }

  async updateCorreo(companyCode: string, input: UpdateFeCorreoInput, userId?: string) {
    await this.db.company.findUniqueOrThrow({ where: { code: companyCode } });
    const empresa = await this.empresaRepo.findOptionalByCompanyCode(companyCode);
    if (!empresa) {
      throw new FeDomainError(
        "Guarde primero los datos del emisor antes de configurar el correo",
        "FE_EMPRESA_NO_CONFIGURADA"
      );
    }
    const updated = await this.empresaRepo.updateCorreo(companyCode, input, userId);
    return serializeFeEmpresa(updated);
  }

  async testCorreo(companyCode: string, input: TestFeCorreoInput) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const overrides: Parameters<typeof feCorreoService.enviarPrueba>[0]["overrides"] = {};
    if (input.mailProvider !== undefined) overrides.mailProvider = input.mailProvider;
    if (input.smtpHost !== undefined) overrides.smtpHost = input.smtpHost;
    if (input.smtpPort !== undefined) overrides.smtpPort = input.smtpPort;
    if (input.smtpSecure !== undefined) overrides.smtpSecure = input.smtpSecure;
    if (input.smtpUser !== undefined) overrides.smtpUser = input.smtpUser;
    if (input.smtpFrom !== undefined) overrides.smtpFrom = input.smtpFrom;
    if (input.correoRemitente !== undefined) overrides.correoRemitente = input.correoRemitente;
    if (input.correoNombre !== undefined) overrides.correoNombre = input.correoNombre;
    if (input.smtpPass !== undefined) overrides.smtpPass = input.smtpPass;

    const hasOverrides = Object.keys(overrides).length > 0;
    return feCorreoService.enviarPrueba({
      empresa,
      to: input.to,
      overrides: hasOverrides ? overrides : undefined,
    });
  }

  async testAtv(companyCode: string, input: TestFeAtvInput) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const targetAmbiente = input.forAmbiente ?? empresa.ambiente;
    const isStaging = targetAmbiente === "STAGING";

    const storedUsuario = isStaging
      ? (empresa.atvUsuarioStg?.trim() || empresa.atvUsuario?.trim())
      : empresa.atvUsuario?.trim();
    const atvUsuario = input.atvUsuario?.trim() || storedUsuario;
    if (!atvUsuario) {
      throw new FeDomainError("Indique el usuario ATV / Tribu", "FE_ATV_USUARIO_REQUERIDO");
    }

    const storedPasswordEnc = isStaging
      ? (empresa.atvPasswordEncStg ?? empresa.atvPasswordEnc)
      : empresa.atvPasswordEnc;
    const passwordPlain = input.atvPassword?.trim();
    const atvPasswordEnc = passwordPlain ? encryptCertPassword(passwordPlain) : storedPasswordEnc;
    if (!atvPasswordEnc) {
      throw new FeDomainError("Indique la contraseña ATV", "FE_ATV_PASSWORD_REQUERIDA");
    }

    feTokenHaciendaService.clearCache(companyCode, targetAmbiente);
    await feTokenHaciendaService.obtenerToken({
      ...empresa,
      ambiente: targetAmbiente,
      atvUsuario: isStaging ? null : atvUsuario,
      atvPasswordEnc: isStaging ? null : atvPasswordEnc,
      atvUsuarioStg: isStaging ? atvUsuario : null,
      atvPasswordEncStg: isStaging ? atvPasswordEnc : null,
    });
    return { ok: true as const, ambiente: targetAmbiente };
  }

  async upsertEmpresa(companyCode: string, input: UpsertFeEmpresaInput & { atvPasswordStg?: string }, userId?: string) {
    const company = await this.db.company.findUnique({ where: { code: companyCode } });
    if (!company) {
      throw new FeDomainError(`Empresa ${companyCode} no existe en el catálogo`, "FE_COMPANY_NOT_FOUND");
    }

    const payload = {
      ...input,
      nombreComercial: input.nombreComercial || company.name,
      razonSocial: input.razonSocial || company.name,
      proveedorSistemas:
        input.proveedorSistemas?.trim() ||
        input.cedulaJuridica.replace(/\D/g, ""),
    };

    const empresa = await this.empresaRepo.upsertByCompanyCode(companyCode, payload, userId);
    return serializeFeEmpresa(empresa);
  }

  async uploadCertificado(
    companyCode: string,
    file: { name: string; buffer: Buffer },
    password: string,
    userId?: string,
    forAmbiente?: "STAGING" | "PRODUCCION"
  ) {
    if (!file.name.toLowerCase().endsWith(".p12") && !file.name.toLowerCase().endsWith(".pfx")) {
      throw new FeDomainError("El certificado debe ser .p12 o .pfx", "FE_CERT_INVALID_TYPE");
    }
    if (file.buffer.length > 5 * 1024 * 1024) {
      throw new FeDomainError("Certificado demasiado grande (máx. 5 MB)", "FE_CERT_TOO_LARGE");
    }

    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const dir = feCertificadosDir(companyCode);
    await ensureFeDir(dir);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
    const storedName = `${Date.now()}_${safeName}`;
    const absPath = path.join(dir, storedName);
    await writeFile(absPath, file.buffer);

    const relPath = feRelativePath(companyCode, "certificados", storedName);
    const resolved = resolveUnderRoot(FE_STORAGE_ROOT, relPath);
    if (!resolved) {
      throw new FeDomainError("Ruta de certificado inválida", "FE_CERT_PATH_INVALID");
    }

    const isStaging = (forAmbiente ?? empresa.ambiente) === "STAGING";
    const certFields = isStaging
      ? {
          certificadoPathStg: relPath,
          certificadoFileNameStg: file.name.slice(0, 255),
          certificadoPasswordEncStg: encryptCertPassword(password),
        }
      : {
          certificadoPath: relPath,
          certificadoFileName: file.name.slice(0, 255),
          certificadoPasswordEnc: encryptCertPassword(password),
        };

    const updated = await this.empresaRepo.updateCertificado(empresa.id, certFields, userId);

    return serializeFeEmpresa(updated);
  }

  async uploadLogo(
    companyCode: string,
    file: { buffer: Buffer; mime: string },
    userId?: string
  ) {
    if (!["image/png", "image/jpeg"].includes(file.mime)) {
      throw new FeDomainError("Logo debe ser PNG o JPEG", "FE_LOGO_INVALID_TYPE");
    }
    if (file.buffer.length > 2 * 1024 * 1024) {
      throw new FeDomainError("Logo demasiado grande (máx. 2 MB)", "FE_LOGO_TOO_LARGE");
    }

    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const dir = feLogosDir(companyCode);
    await ensureFeDir(dir);

    const ext = file.mime === "image/jpeg" ? ".jpg" : ".png";
    const storedName = `logo_${Date.now()}${ext}`;
    const absPath = path.join(dir, storedName);
    await writeFile(absPath, file.buffer);

    const relPath = feRelativePath(companyCode, "logos", storedName);
    const updated = await this.empresaRepo.updateLogo(empresa.id, relPath, userId);
    return serializeFeEmpresa(updated);
  }

  async clearLogo(companyCode: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    const updated = await this.empresaRepo.updateLogo(empresa.id, null, userId);
    return serializeFeEmpresa(updated);
  }

  async createSucursal(companyCode: string, input: CreateFeSucursalInput, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    return this.sucursalRepo.create(empresa.id, input, userId);
  }

  async updateSucursal(
    companyCode: string,
    sucursalId: string,
    input: UpdateFeSucursalInput,
    userId?: string
  ) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.sucursalRepo.findById(sucursalId, empresa.id);
    return this.sucursalRepo.update(sucursalId, input, userId);
  }

  async deleteSucursal(companyCode: string, sucursalId: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.sucursalRepo.findById(sucursalId, empresa.id);
    return this.sucursalRepo.softDelete(sucursalId, userId);
  }

  async createPuntoVenta(
    companyCode: string,
    sucursalId: string,
    input: CreateFePuntoVentaInput,
    userId?: string
  ) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.sucursalRepo.findById(sucursalId, empresa.id);
    return serializeFePuntoVenta(
      await this.puntoVentaRepo.create(
        sucursalId,
        input,
        [...FE_CONSECUTIVO_TIPOS],
        userId
      )
    );
  }

  async updatePuntoVenta(
    companyCode: string,
    puntoVentaId: string,
    input: UpdateFePuntoVentaInput,
    userId?: string
  ) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.puntoVentaRepo.findById(puntoVentaId, empresa.id);
    return this.puntoVentaRepo.update(puntoVentaId, input, userId);
  }

  async deletePuntoVenta(companyCode: string, puntoVentaId: string, userId?: string) {
    const empresa = await this.empresaRepo.findByCompanyCode(companyCode);
    await this.puntoVentaRepo.findById(puntoVentaId, empresa.id);
    return this.puntoVentaRepo.softDelete(puntoVentaId, userId);
  }
}

export class FeConsecutivoService {
  private readonly repo: FeConsecutivoRepository;

  constructor(db: PrismaClient = prisma) {
    this.repo = new FeConsecutivoRepository(db);
  }

  nextNumero(puntoVentaId: string, tipo: Parameters<FeConsecutivoRepository["nextNumero"]>[1]) {
    return this.repo.nextNumero(puntoVentaId, tipo);
  }
}
