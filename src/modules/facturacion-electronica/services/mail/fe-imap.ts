import type { FeEmpresa } from "@prisma/client";

export type FeImapSource = Pick<
  FeEmpresa,
  | "imapEnabled"
  | "imapHost"
  | "imapPort"
  | "imapSecure"
  | "imapUser"
  | "imapPass"
  | "imapFolder"
  | "imapPuntoVentaId"
>;

export type FeImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  folder: string;
  puntoVentaId: string;
};

export type FeImapOverrides = Partial<{
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean | null;
  imapUser: string | null;
  imapPass: string | undefined;
  imapFolder: string | null;
}>;

function mergeSource(base: FeImapSource | null | undefined, overrides?: FeImapOverrides): FeImapSource {
  const b: FeImapSource = base ?? {
    imapEnabled: false,
    imapHost: null,
    imapPort: 993,
    imapSecure: true,
    imapUser: null,
    imapPass: null,
    imapFolder: "INBOX",
    imapPuntoVentaId: null,
  };
  if (!overrides) return b;
  return {
    ...b,
    imapHost: overrides.imapHost !== undefined ? overrides.imapHost : b.imapHost,
    imapPort: overrides.imapPort !== undefined ? overrides.imapPort : b.imapPort,
    imapSecure: overrides.imapSecure !== undefined ? overrides.imapSecure : b.imapSecure,
    imapUser: overrides.imapUser !== undefined ? overrides.imapUser : b.imapUser,
    imapFolder: overrides.imapFolder !== undefined ? overrides.imapFolder : b.imapFolder,
    imapPass: b.imapPass,
  };
}

export function resolveFeImapConfig(
  source?: FeImapSource | null,
  overrides?: FeImapOverrides
): FeImapConfig | null {
  const r = mergeSource(source, overrides);
  if (!r.imapEnabled) return null;

  const host = r.imapHost?.trim();
  const user = r.imapUser?.trim();
  const pass = overrides?.imapPass?.trim() || r.imapPass?.trim();
  const puntoVentaId = r.imapPuntoVentaId?.trim();

  if (!host || !user || !pass || !puntoVentaId) return null;

  return {
    host,
    port: r.imapPort ?? 993,
    secure: r.imapSecure ?? true,
    user,
    pass,
    folder: r.imapFolder?.trim() || "INBOX",
    puntoVentaId,
  };
}

export function feImapConfigured(source?: FeImapSource | null): boolean {
  return resolveFeImapConfig(source) !== null;
}

export function feImapSourceFromEmpresa(empresa: FeEmpresa): FeImapSource {
  return {
    imapEnabled: empresa.imapEnabled,
    imapHost: empresa.imapHost,
    imapPort: empresa.imapPort,
    imapSecure: empresa.imapSecure,
    imapUser: empresa.imapUser,
    imapPass: empresa.imapPass,
    imapFolder: empresa.imapFolder,
    imapPuntoVentaId: empresa.imapPuntoVentaId,
  };
}
