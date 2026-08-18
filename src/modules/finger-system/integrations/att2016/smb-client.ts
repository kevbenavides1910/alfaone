import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ensureFingerSettingsRow } from "@/modules/finger-system/services/finger-settings";
import { FINGER_ENV } from "@/modules/finger-system/config/finger.config";

const execFileAsync = promisify(execFile);

export type Att2016SmbConfig = {
  share: string;
  user: string;
  password: string;
  databaseFile: string;
};

/** Resuelve share y archivo MDB desde BD (app_finger_settings) con fallback a env. */
export async function resolveAtt2016SmbConfig(): Promise<Att2016SmbConfig | null> {
  const password = FINGER_ENV.attSmbPassword();
  if (!password) return null;

  const settings = await ensureFingerSettingsRow();
  return {
    share: settings.attSmbShare?.trim() || FINGER_ENV.attSmbShare(),
    user: FINGER_ENV.attSmbUser(),
    password,
    databaseFile: settings.attDatabaseName?.trim() || FINGER_ENV.attDatabaseName(),
  };
}

export async function isAtt2016SmbConfigured(): Promise<boolean> {
  return (await resolveAtt2016SmbConfig()) != null;
}

/** Descarga ATT2016.MDB del share SMB a un archivo temporal (solo lectura). */
export async function fetchAtt2016MdbCopy(): Promise<{ localPath: string; cleanup: () => Promise<void> }> {
  const config = await resolveAtt2016SmbConfig();
  if (!config) {
    throw new Error(
      "No fue posible conectar con la base biométrica. Configure ATT2016_SMB_PASSWORD en el servidor.",
    );
  }

  const databaseFile = config.databaseFile;
  const shareMatch = config.share.match(/^\/\/([^/]+)\/(.+)$/);
  if (!shareMatch) {
    throw new Error("Formato de share SMB inválido. Use //host/share.");
  }

  const [, host, shareName] = shareMatch;
  const smbTarget = `//${host}/${shareName}`;
  const tmpDir = await mkdtemp(path.join(tmpdir(), "finger-att2016-"));
  const localPath = path.join(tmpDir, databaseFile.replace(/[/\\]/g, "_"));

  const args = [
    smbTarget,
    "-U",
    config.user ? `${config.user}%${config.password}` : `%${config.password}`,
    "-c",
    `get "${databaseFile}" "${localPath}"`,
  ];

  try {
    await execFileAsync("smbclient", args, { timeout: 120_000 });
    await access(localPath, constants.R_OK);
    const stat = await readFile(localPath).then((b) => b.length);
    if (stat < 1024) {
      throw new Error("El archivo MDB descargado está vacío o es inválido.");
    }
  } catch {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(
      "No fue posible descargar la base biométrica. Verifique ruta SMB, credenciales, red o que ATT2016.MDB no esté bloqueado.",
    );
  }

  return {
    localPath,
    cleanup: async () => {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

/** Sube una copia local modificada de ATT2016.MDB al share SMB (requiere attReadOnly=false). */
export async function uploadAtt2016MdbCopy(localPath: string): Promise<void> {
  const config = await resolveAtt2016SmbConfig();
  if (!config) {
    throw new Error(
      "No fue posible conectar con la base biométrica. Configure ATT2016_SMB_PASSWORD en el servidor.",
    );
  }

  const databaseFile = config.databaseFile;
  const shareMatch = config.share.match(/^\/\/([^/]+)\/(.+)$/);
  if (!shareMatch) {
    throw new Error("Formato de share SMB inválido. Use //host/share.");
  }

  const [, host, shareName] = shareMatch;
  const smbTarget = `//${host}/${shareName}`;

  const args = [
    smbTarget,
    "-U",
    config.user ? `${config.user}%${config.password}` : `%${config.password}`,
    "-c",
    `put "${localPath}" "${databaseFile}"`,
  ];

  try {
    await execFileAsync("smbclient", args, { timeout: 180_000 });
  } catch {
    throw new Error(
      "No fue posible subir la base biométrica. Verifique ruta SMB, credenciales, permisos de escritura o que ATT2016 no esté bloqueado.",
    );
  }
}
