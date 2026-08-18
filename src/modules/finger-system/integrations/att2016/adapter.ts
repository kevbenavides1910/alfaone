import { prisma } from "@/modules/core/db/prisma";
import { FINGER_ENV } from "@/modules/finger-system/config/finger.config";
import {
  resolveAtt2016SmbConfig,
  testAtt2016SmbAccess,
  type Att2016SmbCredentialsOverride,
} from "@/modules/finger-system/integrations/att2016/smb-client";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";
import { mdbCountTable, mdbListTables } from "@/modules/finger-system/integrations/att2016/mdb-reader";
import type { Att2016ProbeResult, Att2016SchemaSnapshot } from "./types";

/**
 * Adaptador de lectura ATT2016 vía SMB con credenciales configuradas en Finger System.
 */
export async function probeAtt2016Connection(overrides?: {
  sharePath?: string | null;
  databaseName?: string | null;
  smbUser?: string | null;
  smbPassword?: string | null;
}): Promise<Att2016ProbeResult> {
  const settings = await prisma.appFingerSettings.findUnique({ where: { id: "default" } });
  const readOnly = settings?.attReadOnly ?? true;
  const sharePath =
    overrides?.sharePath?.trim() ||
    settings?.attSmbShare?.trim() ||
    FINGER_ENV.attSmbShare();
  const databaseName =
    overrides?.databaseName?.trim() ||
    settings?.attDatabaseName?.trim() ||
    FINGER_ENV.attDatabaseName();
  const connectionString = FINGER_ENV.attConnectionString();

  if (connectionString) {
    return {
      configured: true,
      reachable: false,
      readOnly,
      connectionType: "mssql",
      sharePath,
      databaseName,
      message:
        "Cadena SQL configurada. La conexión directa se habilitará en la siguiente fase de integración.",
    };
  }

  const credOverrides: Att2016SmbCredentialsOverride = {
    user: overrides?.smbUser,
    password: overrides?.smbPassword,
    share: sharePath,
    databaseFile: databaseName,
  };

  const stored = await resolveAtt2016SmbConfig(
    overrides?.smbPassword?.trim()
      ? credOverrides
      : { share: sharePath, databaseFile: databaseName },
  );

  const user =
    overrides?.smbUser?.trim() || stored?.user || settings?.attSmbUser?.trim() || "";
  const password = overrides?.smbPassword?.trim() || stored?.password || "";

  if (!password) {
    return {
      configured: false,
      reachable: false,
      readOnly,
      connectionType: "smb",
      sharePath,
      databaseName,
      message: "Indique usuario y contraseña de red con acceso al share SMB.",
    };
  }

  const shareMatch = sharePath.match(/^\/\/([^/]+)\/(.+)$/);
  if (!shareMatch) {
    return {
      configured: true,
      reachable: false,
      readOnly,
      connectionType: "unknown",
      sharePath,
      databaseName,
      message: "Formato de share SMB inválido. Use //host/share.",
    };
  }

  const access = await testAtt2016SmbAccess({
    share: sharePath,
    databaseName,
    user,
    password,
  });

  const reachable = access.canConnect && access.canReadDatabase;

  return {
    configured: true,
    reachable,
    readOnly,
    connectionType: "mdb",
    sharePath,
    databaseName,
    message: access.message,
    canWriteShare: access.canWriteShare,
    canReadDatabase: access.canReadDatabase,
  };
}

export async function introspectAtt2016Schema(): Promise<Att2016SchemaSnapshot> {
  const probe = await probeAtt2016Connection();
  if (!probe.reachable) {
    return {
      probedAt: new Date().toISOString(),
      tables: [],
      message: probe.message,
    };
  }

  try {
    return await withAtt2016MdbRead(async (mdb) => {
      const names = await mdbListTables(mdb);
      const keyTables = ["USERINFO", "CHECKINOUT", "Machines", "DEPARTMENTS", "TEMPLATE", "SCHCLASS"];
      const tables = await Promise.all(
        names.map(async (name) => ({
          name,
          rowCount: keyTables.includes(name) ? await mdbCountTable(mdb, name) : undefined,
        })),
      );
      return {
        probedAt: new Date().toISOString(),
        tables,
        message: `Introspección OK: ${names.length} tablas en ${probe.databaseName}.`,
      };
    });
  } catch (e) {
    return {
      probedAt: new Date().toISOString(),
      tables: [],
      message:
        e instanceof Error
          ? e.message
          : "No fue posible introspectar ATT2016. Verifique credenciales SMB de red.",
    };
  }
}
