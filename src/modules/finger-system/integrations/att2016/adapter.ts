import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { prisma } from "@/modules/core/db/prisma";
import { FINGER_ENV } from "@/modules/finger-system/config/finger.config";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";
import { mdbCountTable, mdbListTables } from "@/modules/finger-system/integrations/att2016/mdb-reader";
import type { Att2016ProbeResult, Att2016SchemaSnapshot } from "./types";

const execFileAsync = promisify(execFile);

/**
 * Adaptador de lectura ATT2016. Por defecto solo diagnóstico de conectividad SMB.
 * La introspección de tablas se implementará cuando haya credenciales válidas.
 */
export async function probeAtt2016Connection(overrides?: {
  sharePath?: string | null;
  databaseName?: string | null;
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
  const password = FINGER_ENV.attSmbPassword();
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

  if (!password) {
    return {
      configured: false,
      reachable: false,
      readOnly,
      connectionType: "smb",
      sharePath,
      databaseName,
      message:
        "Configure ATT2016_SMB_PASSWORD (o NAF_SMB_PASSWORD) para acceder al share DB-Biometrico.",
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

  const [, host, shareName] = shareMatch;
  const user = FINGER_ENV.attSmbUser();
  const smbTarget = `//${host}/${shareName}`;

  try {
    const args = ["-c", `ls "${databaseName}"`];
    if (user) args.unshift("-U", `${user}%${password}`);
    else args.unshift("-N");
    args.unshift(smbTarget);

    await execFileAsync("smbclient", args, { timeout: 15_000 });

    return {
      configured: true,
      reachable: true,
      readOnly,
      connectionType: "mdb",
      sharePath,
      databaseName,
      message: `Share accesible. Base activa: ${databaseName} (Microsoft Access / ZKTeco).`,
    };
  } catch {
    return {
      configured: true,
      reachable: false,
      readOnly,
      connectionType: "smb",
      sharePath,
      databaseName,
      message:
        "No fue posible acceder al share biométrico. Verifique credenciales, red o permisos en DB-Biometrico.",
    };
  }
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
          : "No fue posible introspectar ATT2016. Verifique Docker y credenciales SMB.",
    };
  }
}
