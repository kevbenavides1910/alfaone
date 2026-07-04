import type { Prisma, PrismaClient } from "@prisma/client";
import { FeNotFoundError } from "../errors/fe-errors";
import { notDeleted } from "../utils/soft-delete";
import type { UpsertFeEmpresaInput } from "../validators/empresa.schema";
import { encryptCertPassword } from "../utils/crypto-certificado";

export class FeEmpresaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findOptionalByCompanyCode(companyCode: string) {
    return this.prisma.feEmpresa.findFirst({
      where: { companyCode, ...notDeleted },
    });
  }

  async findByCompanyCode(companyCode: string) {
    const row = await this.findOptionalByCompanyCode(companyCode);
    if (!row || !row.isActive) {
      throw new FeNotFoundError(`No hay configuración FE para la empresa ${companyCode}`);
    }
    return row;
  }

  async upsertByCompanyCode(
    companyCode: string,
    input: UpsertFeEmpresaInput & { atvPassword?: string; atvPasswordStg?: string },
    userId?: string
  ) {
    const existing = await this.findOptionalByCompanyCode(companyCode);
    const { atvPassword, atvPasswordStg, ...rest } = input;
    const data: Prisma.FeEmpresaUpdateInput = {
      ...rest,
      updatedById: userId,
      ...(atvPassword ? { atvPasswordEnc: encryptCertPassword(atvPassword) } : {}),
      ...(atvPasswordStg ? { atvPasswordEncStg: encryptCertPassword(atvPasswordStg) } : {}),
    };

    if (existing) {
      return this.prisma.feEmpresa.update({
        where: { id: existing.id },
        data,
      });
    }

    return this.prisma.feEmpresa.create({
      data: {
        companyCode,
        nombreComercial: input.nombreComercial,
        razonSocial: input.razonSocial,
        cedulaJuridica: input.cedulaJuridica,
        tipoIdentificacion: input.tipoIdentificacion ?? "JURIDICA",
        actividadEconomica: input.actividadEconomica ?? undefined,
        proveedorSistemas: input.proveedorSistemas ?? input.cedulaJuridica.replace(/\D/g, ""),
        exigirUbicacionReceptor: input.exigirUbicacionReceptor ?? true,
        ambiente: input.ambiente,
        atvUsuario: input.atvUsuario ?? input.cedulaJuridica,
        atvPasswordEnc: atvPassword ? encryptCertPassword(atvPassword) : undefined,
        atvUsuarioStg: input.atvUsuarioStg ?? undefined,
        atvPasswordEncStg: atvPasswordStg ? encryptCertPassword(atvPasswordStg) : undefined,
        correoRemitente: input.correoRemitente ?? undefined,
        correoNombre: input.correoNombre ?? undefined,
        telefono: input.telefono ?? undefined,
        email: input.email ?? undefined,
        direccionProvincia: input.direccionProvincia ?? undefined,
        direccionCanton: input.direccionCanton ?? undefined,
        direccionDistrito: input.direccionDistrito ?? undefined,
        direccionBarrio: input.direccionBarrio ?? undefined,
        direccionOtras: input.direccionOtras ?? undefined,
        createdById: userId,
        updatedById: userId,
      },
    });
  }

  updateCertificado(
    empresaId: string,
    data: (
      | { certificadoPath: string; certificadoFileName: string; certificadoPasswordEnc: string; certificadoExpiresAt?: Date | null }
      | { certificadoPathStg: string; certificadoFileNameStg: string; certificadoPasswordEncStg: string; certificadoExpiresAtStg?: Date | null }
    ),
    userId?: string
  ) {
    return this.prisma.feEmpresa.update({
      where: { id: empresaId },
      data: { ...data, updatedById: userId },
    });
  }

  async updateCorreo(
    companyCode: string,
    input: {
      mailProvider: string;
      smtpHost?: string | null;
      smtpPort?: number | null;
      smtpSecure?: boolean | null;
      smtpUser?: string | null;
      smtpPass?: string;
      smtpFrom?: string | null;
      correoRemitente?: string | null;
      correoNombre?: string | null;
      correoCopiaFija?: string | null;
    },
    userId?: string
  ) {
    const empresa = await this.findByCompanyCode(companyCode);
    const { smtpPass, ...rest } = input;
    return this.prisma.feEmpresa.update({
      where: { id: empresa.id },
      data: {
        ...rest,
        ...(smtpPass ? { smtpPass } : {}),
        updatedById: userId,
      },
    });
  }

  updateLogo(empresaId: string, logoPath: string | null, userId?: string) {
    return this.prisma.feEmpresa.update({
      where: { id: empresaId },
      data: { logoPath, updatedById: userId },
    });
  }

  async updateImap(
    companyCode: string,
    input: {
      imapEnabled: boolean;
      imapHost?: string | null;
      imapPort?: number | null;
      imapSecure?: boolean | null;
      imapUser?: string | null;
      imapPass?: string;
      imapFolder?: string | null;
      imapPuntoVentaId?: string | null;
    },
    userId?: string
  ) {
    const empresa = await this.findByCompanyCode(companyCode);
    const { imapPass, ...rest } = input;
    return this.prisma.feEmpresa.update({
      where: { id: empresa.id },
      data: {
        ...rest,
        ...(imapPass ? { imapPass } : {}),
        updatedById: userId,
      },
    });
  }
}
