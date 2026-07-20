import { execFile } from "child_process";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "fs/promises";
import { constants } from "fs";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import {
  expedienteTipoDir,
  pickBestExpedientePdfFilename,
} from "@/modules/expediente-digital/business/paths";

const execFileAsync = promisify(execFile);

export type ExpedienteSmbConfig = {
  share: string;
  user: string;
  password: string;
};

/**
 * Credenciales Samba del share Expediente Digital (10.1.1.6).
 * Preferir EXPEDIENTE_SMB_*; si no hay password, reutiliza NAF_SMB_PASSWORD.
 */
export function expedienteSmbConfig(): ExpedienteSmbConfig | null {
  const password =
    process.env.EXPEDIENTE_SMB_PASSWORD?.trim() ||
    process.env.NAF_SMB_PASSWORD?.trim();
  if (!password) return null;

  return {
    share:
      process.env.EXPEDIENTE_SMB_SHARE?.trim() ||
      "//10.1.1.6/Expediente Digital",
    user:
      process.env.EXPEDIENTE_SMB_USER?.trim() ||
      process.env.NAF_SMB_USER?.trim() ||
      "oracle",
    password,
  };
}

/** Montaje local CIFS/bind (p. ej. /data/expediente-digital) como alternativa a smbclient. */
export function expedienteFsRoot(): string | null {
  const root = process.env.EXPEDIENTE_FS_ROOT?.trim();
  return root || null;
}

export function isExpedienteSmbConfigured(): boolean {
  return expedienteSmbConfig() != null || expedienteFsRoot() != null;
}

async function withSmbTemp<T>(fn: (tmpDir: string) => Promise<T>): Promise<T> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "expediente-smb-"));
  try {
    return await fn(tmpDir);
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function fetchFromFs(remoteRelativePath: string): Promise<Buffer | null> {
  const root = expedienteFsRoot();
  if (!root) return null;
  const full = path.join(root, ...remoteRelativePath.replace(/\\/g, "/").split("/"));
  try {
    await access(full, constants.R_OK);
    const buf = await readFile(full);
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  }
}

async function putToFs(remoteRelativePath: string, data: Buffer): Promise<boolean> {
  const root = expedienteFsRoot();
  if (!root) return false;
  const full = path.join(root, ...remoteRelativePath.replace(/\\/g, "/").split("/"));
  try {
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, data);
    return true;
  } catch {
    return false;
  }
}

async function listDirFromFs(dirRelative: string): Promise<string[] | null> {
  const root = expedienteFsRoot();
  if (!root) return null;
  const full = path.join(root, ...dirRelative.replace(/\\/g, "/").split("/"));
  try {
    return await readdir(full);
  } catch {
    return null;
  }
}

async function listDirFromSmb(dirRelative: string): Promise<string[] | null> {
  const config = expedienteSmbConfig();
  if (!config) return null;

  return withSmbTemp(async () => {
    const auth = `${config.user}%${config.password}`;
    try {
      const { stdout } = await execFileAsync(
        "smbclient",
        [config.share, "-U", auth, "-c", `cd "${dirRelative}"; ls`],
        { timeout: 60_000, maxBuffer: 4 * 1024 * 1024 },
      );
      const names: string[] = [];
      for (const line of String(stdout).split("\n")) {
        const m = line.trim().match(/^\s*([^\s].+\.pdf)\s/i);
        if (m?.[1]) names.push(m[1].trim());
      }
      return names.length ? names : null;
    } catch {
      return null;
    }
  });
}

/** Lista nombres de archivo en una carpeta de tipo (FS local o SMB). */
export async function listExpedienteTipoFilenames(
  tipoFolder: string,
): Promise<string[] | null> {
  const dirRel = expedienteTipoDir(tipoFolder);
  return (await listDirFromFs(dirRel)) ?? (await listDirFromSmb(dirRel));
}

/** Busca PDF por prefijo de NO_EMPLE cuando los nombres NAF no coinciden con la versión Oracle. */
export async function findExpedientePdfByPrefix(
  tipoFolder: string,
  noEmple: string,
  nVersion?: number | null,
): Promise<string | null> {
  const dirRel = expedienteTipoDir(tipoFolder);
  const names = await listExpedienteTipoFilenames(tipoFolder);
  if (!names?.length) return null;
  const file = pickBestExpedientePdfFilename(names, noEmple, nVersion);
  return file ? `${dirRel}/${file}` : null;
}

export async function fetchExpedienteSmbFile(
  remoteRelativePath: string,
): Promise<Buffer | null> {
  const fromFs = await fetchFromFs(remoteRelativePath);
  if (fromFs) return fromFs;

  const config = expedienteSmbConfig();
  if (!config) return null;

  return withSmbTemp(async (tmpDir) => {
    const localPath = path.join(tmpDir, "documento.pdf");
    const auth = `${config.user}%${config.password}`;
    try {
      await execFileAsync(
        "smbclient",
        [
          config.share,
          "-U",
          auth,
          "-c",
          `get "${remoteRelativePath}" "${localPath}"`,
        ],
        { timeout: 60_000 },
      );
      const buf = await readFile(localPath);
      return buf.length > 0 ? buf : null;
    } catch {
      return null;
    }
  });
}

export async function putExpedienteSmbFile(
  remoteRelativePath: string,
  data: Buffer,
): Promise<boolean> {
  if (await putToFs(remoteRelativePath, data)) return true;

  const config = expedienteSmbConfig();
  if (!config) return false;

  const remote = remoteRelativePath.replace(/\\/g, "/");
  const remoteFile = path.posix.basename(remote);
  const remoteDir = path.posix.dirname(remote);

  return withSmbTemp(async (tmpDir) => {
    const localPath = path.join(tmpDir, remoteFile);
    await writeFile(localPath, data);
    const auth = `${config.user}%${config.password}`;
    const tryPut = async (cmd: string) => {
      await execFileAsync(
        "smbclient",
        [config.share, "-U", auth, "-c", cmd],
        { timeout: 120_000 },
      );
    };
    try {
      await tryPut(`mkdir "${remoteDir}"; put "${localPath}" "${remote}"`);
    } catch {
      try {
        await tryPut(`put "${localPath}" "${remote}"`);
      } catch {
        return false;
      }
    }
    const check = await fetchExpedienteSmbFile(remote);
    return Boolean(check && check.length > 0);
  });
}
