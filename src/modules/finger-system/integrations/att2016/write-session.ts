import { fetchAtt2016MdbCopy, uploadAtt2016MdbCopy } from "./smb-client";

/** Descarga ATT2016, permite modificación local y sube de vuelta al share SMB. */
export async function withAtt2016MdbWrite<T>(fn: (localMdbPath: string) => Promise<T>): Promise<T> {
  const { localPath, cleanup } = await fetchAtt2016MdbCopy();
  try {
    const result = await fn(localPath);
    await uploadAtt2016MdbCopy(localPath);
    return result;
  } finally {
    await cleanup();
  }
}
