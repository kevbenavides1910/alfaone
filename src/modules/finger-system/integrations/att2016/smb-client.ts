import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ensureFingerSettingsRow } from "@/modules/finger-system/services/finger-settings";
import { FINGER_ENV } from "@/modules/finger-system/config/finger.config";
import {
  decryptFingerSmbPassword,
} from "@/modules/finger-system/utils/finger-smb-crypto";

const execFileAsync = promisify(execFile);

export type Att2016SmbConfig = {
  share: string;
  user: string;
  password: string;
  databaseFile: string;
};

export type Att2016SmbCredentialsOverride = {
  user?: string | null;
  password?: string | null;
  share?: string | null;
  databaseFile?: string | null;
};

export type Att2016SmbAccessResult = {
  share: string;
  databaseName: string;
  user: string;
  canConnect: boolean;
  canReadDatabase: boolean;
  canWriteShare: boolean;
  message: string;
};

function smbAuthArgs(user: string, password: string): string[] {
  if (!password) return ["-N"];
  const u = user.trim();
  return ["-U", u ? `${u}%${password}` : `%${password}`];
}

function parseSharePath(sharePath: string): { smbTarget: string; host: string; shareName: string } {
  const shareMatch = sharePath.match(/^\/\/([^/]+)\/(.+)$/);
  if (!shareMatch) {
    throw new Error("Formato de share SMB inválido. Use //servidor/carpeta.");
  }
  const [, host, shareName] = shareMatch;
  return { smbTarget: `//${host}/${shareName}`, host, shareName };
}

async function runSmbClient(
  smbTarget: string,
  user: string,
  password: string,
  command: string,
  timeoutMs = 30_000,
): Promise<string> {
  const args = [smbTarget, ...smbAuthArgs(user, password), "-c", command];
  const { stdout } = await execFileAsync("smbclient", args, {
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
  });
  return stdout;
}

/** Resuelve share, usuario y contraseña desde BD (sin fallback a .env). */
export async function resolveAtt2016SmbConfig(
  overrides?: Att2016SmbCredentialsOverride,
): Promise<Att2016SmbConfig | null> {
  const settings = await ensureFingerSettingsRow();

  const password =
    overrides?.password?.trim() ||
    (settings.attSmbPasswordEnc ? decryptFingerSmbPassword(settings.attSmbPasswordEnc) : "");
  if (!password) return null;

  return {
    share: overrides?.share?.trim() || settings.attSmbShare?.trim() || FINGER_ENV.attSmbShare(),
    user: overrides?.user?.trim() || settings.attSmbUser?.trim() || "",
    password,
    databaseFile:
      overrides?.databaseFile?.trim() ||
      settings.attDatabaseName?.trim() ||
      FINGER_ENV.attDatabaseName(),
  };
}

export async function isAtt2016SmbConfigured(): Promise<boolean> {
  return (await resolveAtt2016SmbConfig()) != null;
}

/** Verifica lectura del MDB y permiso de escritura en el share (administración). */
export async function testAtt2016SmbAccess(params: {
  share: string;
  databaseName: string;
  user: string;
  password: string;
}): Promise<Att2016SmbAccessResult> {
  const share = params.share.trim();
  const databaseName = params.databaseName.trim();
  const user = params.user.trim();
  const password = params.password;

  const base: Att2016SmbAccessResult = {
    share,
    databaseName,
    user: user || "(guest)",
    canConnect: false,
    canReadDatabase: false,
    canWriteShare: false,
    message: "",
  };

  if (!password) {
    return {
      ...base,
      message: "Indique usuario y contraseña de red con acceso al share SMB.",
    };
  }

  let smbTarget: string;
  try {
    ({ smbTarget } = parseSharePath(share));
  } catch (e) {
    return {
      ...base,
      message: e instanceof Error ? e.message : "Share SMB inválido.",
    };
  }

  try {
    await runSmbClient(smbTarget, user, password, "ls", 15_000);
    base.canConnect = true;
  } catch {
    return {
      ...base,
      message:
        "No fue posible conectar al share. Verifique usuario, contraseña de red, VPN o que la carpeta compartida exista.",
    };
  }

  try {
    await runSmbClient(smbTarget, user, password, `ls "${databaseName}"`, 15_000);
    base.canReadDatabase = true;
  } catch {
    return {
      ...base,
      message: `Share accesible, pero no se encontró ${databaseName}. Verifique la ruta o permisos de lectura.`,
    };
  }

  const probeName = `.finger-probe-${Date.now()}.tmp`;
  const tmpDir = await mkdtemp(path.join(tmpdir(), "finger-smb-probe-"));
  const localProbe = path.join(tmpDir, "probe.txt");
  try {
    await writeFile(localProbe, "finger-system-probe");
    await runSmbClient(
      smbTarget,
      user,
      password,
      `put "${localProbe}" "${probeName}"; del "${probeName}"`,
      20_000,
    );
    base.canWriteShare = true;
    base.message = `Conexión OK. Lectura de ${databaseName} y permisos de administración (escritura) en el share.`;
  } catch {
    base.message = `Conexión y lectura OK, pero el usuario no tiene permiso de escritura/administración en ${share}. Se requiere para sincronizar y respaldar ATT2016.`;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }

  return base;
}

/** Lista archivos en el share SMB (filtra .mdb / .accdb). */
export async function listAtt2016ShareFiles(
  shareOverride?: string,
  credentials?: Att2016SmbCredentialsOverride,
): Promise<{
  share: string;
  files: { name: string; sizeBytes: number | null }[];
}> {
  const config = await resolveAtt2016SmbConfig({
    ...credentials,
    share: shareOverride ?? credentials?.share,
  });
  if (!config) {
    throw new Error("Configure usuario y contraseña de red SMB en la conexión ATT2016.");
  }

  const share = shareOverride?.trim() || config.share;
  const { smbTarget } = parseSharePath(share);
  const stdout = await runSmbClient(smbTarget, config.user, config.password, "ls");
  const files: { name: string; sizeBytes: number | null }[] = [];

  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(".") || trimmed.startsWith("blocks")) continue;
    const match = trimmed.match(/^(.+?)\s+[ADHRS]+\s+(\d+)/i);
    if (!match) continue;
    const name = match[1]!.trim();
    if (!/\.(mdb|accdb)$/i.test(name)) continue;
    files.push({ name, sizeBytes: Number.parseInt(match[2]!, 10) || null });
  }

  files.sort((a, b) => a.name.localeCompare(b.name));
  return { share, files };
}

/** Descarga ATT2016.MDB del share SMB a un archivo temporal (solo lectura). */
export async function fetchAtt2016MdbCopy(): Promise<{ localPath: string; cleanup: () => Promise<void> }> {
  const config = await resolveAtt2016SmbConfig();
  if (!config) {
    throw new Error(
      "No fue posible conectar con la base biométrica. Configure credenciales de red SMB en Configuración.",
    );
  }

  const databaseFile = config.databaseFile;
  const { smbTarget } = parseSharePath(config.share);
  const tmpDir = await mkdtemp(path.join(tmpdir(), "finger-att2016-"));
  const localPath = path.join(tmpDir, databaseFile.replace(/[/\\]/g, "_"));

  try {
    await runSmbClient(
      smbTarget,
      config.user,
      config.password,
      `get "${databaseFile}" "${localPath}"`,
      120_000,
    );
    await access(localPath, constants.R_OK);
    const stat = await readFile(localPath).then((b) => b.length);
    if (stat < 1024) {
      throw new Error("El archivo MDB descargado está vacío o es inválido.");
    }
  } catch {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
    throw new Error(
      "No fue posible descargar la base biométrica. Verifique ruta SMB, credenciales de red o que ATT2016.MDB no esté bloqueado.",
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
      "No fue posible conectar con la base biométrica. Configure credenciales de red SMB en Configuración.",
    );
  }

  const databaseFile = config.databaseFile;
  const { smbTarget } = parseSharePath(config.share);

  try {
    await runSmbClient(
      smbTarget,
      config.user,
      config.password,
      `put "${localPath}" "${databaseFile}"`,
      180_000,
    );
  } catch {
    throw new Error(
      "No fue posible subir la base biométrica. Verifique credenciales de red, permisos de escritura o que ATT2016 no esté bloqueado.",
    );
  }
}
