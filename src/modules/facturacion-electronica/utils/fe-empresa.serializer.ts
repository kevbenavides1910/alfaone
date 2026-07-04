import type { FeEmpresa } from "@prisma/client";

export type FeEmpresaPublic = Omit<
  FeEmpresa,
  | "certificadoPasswordEnc"
  | "atvPasswordEnc"
  | "smtpPass"
  | "imapPass"
  | "certificadoPasswordEncStg"
  | "atvPasswordEncStg"
> & {
  hasCertificado: boolean;
  hasCertificadoPassword: boolean;
  hasAtvPassword: boolean;
  hasCertificadoStg: boolean;
  hasCertificadoPasswordStg: boolean;
  hasAtvPasswordStg: boolean;
  hasSmtpPassword: boolean;
  hasImapPassword: boolean;
  smtpConfigured: boolean;
  imapConfigured: boolean;
  hasLogo: boolean;
};

export function serializeFeEmpresa(empresa: FeEmpresa): FeEmpresaPublic {
  const {
    certificadoPasswordEnc,
    atvPasswordEnc,
    smtpPass,
    imapPass,
    certificadoPasswordEncStg,
    atvPasswordEncStg,
    ...rest
  } = empresa;
  const hasSmtpPassword = Boolean(smtpPass?.length);
  const hasImapPassword = Boolean(imapPass?.length);
  const smtpConfigured =
    Boolean(empresa.smtpHost?.trim()) ||
    ["OUTLOOK", "GMAIL"].includes((empresa.mailProvider ?? "").toUpperCase()) ||
    Boolean(process.env.SMTP_HOST?.trim());
  const imapConfigured =
    Boolean(empresa.imapEnabled) &&
    Boolean(empresa.imapHost?.trim()) &&
    Boolean(empresa.imapUser?.trim()) &&
    hasImapPassword &&
    Boolean(empresa.imapPuntoVentaId);
  return {
    ...rest,
    hasCertificado: Boolean(empresa.certificadoPath),
    hasCertificadoPassword: Boolean(certificadoPasswordEnc),
    hasAtvPassword: Boolean(atvPasswordEnc),
    hasCertificadoStg: Boolean(empresa.certificadoPathStg),
    hasCertificadoPasswordStg: Boolean(certificadoPasswordEncStg),
    hasAtvPasswordStg: Boolean(atvPasswordEncStg),
    hasSmtpPassword,
    hasImapPassword,
    smtpConfigured,
    imapConfigured,
    hasLogo: Boolean(empresa.logoPath?.trim()),
  };
}

export function feSmtpSourceFromEmpresa(empresa: FeEmpresa) {
  return {
    mailProvider: empresa.mailProvider,
    smtpHost: empresa.smtpHost,
    smtpPort: empresa.smtpPort,
    smtpSecure: empresa.smtpSecure,
    smtpUser: empresa.smtpUser,
    smtpPass: empresa.smtpPass,
    smtpFrom: empresa.smtpFrom,
    correoRemitente: empresa.correoRemitente,
    correoNombre: empresa.correoNombre,
  };
}
