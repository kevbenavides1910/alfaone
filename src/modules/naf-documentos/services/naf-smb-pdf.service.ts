import { execFile } from "child_process";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";
import { nafSharePdfCandidates } from "../business/naf-share-pdf-filename";

const execFileAsync = promisify(execFile);

export type NafSmbConfig = {
  share: string;
  user: string;
  password: string;
};

export function nafSmbConfig(): NafSmbConfig | null {
  const password = process.env.NAF_SMB_PASSWORD?.trim();
  if (!password) return null;

  return {
    share: process.env.NAF_SMB_SHARE?.trim() || "//10.1.1.6/Facturas en PDF",
    user: process.env.NAF_SMB_USER?.trim() || "oracle",
    password,
  };
}

async function fetchRemoteFile(
  config: NafSmbConfig,
  remoteFile: string,
): Promise<Buffer | null> {
  const tmpDir = await mkdtemp(path.join(tmpdir(), "naf-smb-pdf-"));
  const localPath = path.join(tmpDir, "documento.pdf");

  try {
    const auth = `${config.user}%${config.password}`;
    await execFileAsync(
      "smbclient",
      [config.share, "-U", auth, "-c", `get "${remoteFile}" "${localPath}"`],
      { timeout: 30_000 },
    );
    const buf = await readFile(localPath);
    return buf.length > 0 ? buf : null;
  } catch {
    return null;
  } finally {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function fetchNafSmbPdf(params: {
  noCia: string;
  tipoDoc: string;
  consecutivoFe: string;
}): Promise<{ buf: Buffer; fileName: string } | null> {
  const config = nafSmbConfig();
  if (!config) return null;

  const candidates = nafSharePdfCandidates(
    params.noCia,
    params.tipoDoc,
    params.consecutivoFe,
  );

  for (const remoteFile of candidates) {
    const buf = await fetchRemoteFile(config, remoteFile);
    if (buf) {
      return { buf, fileName: remoteFile };
    }
  }

  return null;
}

export async function isNafSmbPdfConfigured(): Promise<boolean> {
  return nafSmbConfig() != null;
}
