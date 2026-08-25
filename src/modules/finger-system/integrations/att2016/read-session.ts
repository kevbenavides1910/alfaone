import { fetchAtt2016MdbCopy } from "./smb-client";

/** Ejecuta una operación de solo lectura sobre una copia temporal de ATT2016.MDB. */
export async function withAtt2016MdbRead<T>(fn: (localMdbPath: string) => Promise<T>): Promise<T> {
  const { localPath, cleanup } = await fetchAtt2016MdbCopy();
  try {
    return await fn(localPath);
  } finally {
    await cleanup();
  }
}
