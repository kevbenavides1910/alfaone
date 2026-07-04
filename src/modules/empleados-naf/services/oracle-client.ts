import { existsSync } from "fs";
import oracledb from "oracledb";

let clientInitialized = false;

export type NafOracleConfig = {
  user: string;
  password: string;
  connectString: string;
  clientDir?: string;
};

export function getNafOracleConfig(): NafOracleConfig | null {
  const user = process.env.NAF_ORACLE_USER?.trim();
  const password = process.env.NAF_ORACLE_PASSWORD;
  const connectString = process.env.NAF_ORACLE_CONNECT_STRING?.trim();
  if (!user || !password || !connectString) return null;
  return {
    user,
    password,
    connectString,
    clientDir: process.env.NAF_ORACLE_CLIENT_DIR?.trim(),
  };
}

function initOracleClientIfNeeded(clientDir?: string) {
  if (clientInitialized) return;
  const dir =
    clientDir ||
    process.env.NAF_ORACLE_CLIENT_DIR?.trim() ||
    "/opt/oracle/instantclient_19_23";
  if (!existsSync(`${dir}/libclntsh.so`)) {
    throw new Error(
      `Oracle Instant Client no encontrado en ${dir}. Monte el directorio en Docker o ejecute scripts/install-oracle-instant-client-ldconfig.sh en el host.`,
    );
  }
  // libnnz19.so depende de otras libs del mismo directorio; sin LD_LIBRARY_PATH falla DPI-1047.
  if (!process.env.LD_LIBRARY_PATH?.split(":").includes(dir)) {
    process.env.LD_LIBRARY_PATH = process.env.LD_LIBRARY_PATH
      ? `${dir}:${process.env.LD_LIBRARY_PATH}`
      : dir;
  }
  try {
    oracledb.initOracleClient({ libDir: dir });
    clientInitialized = true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!msg.includes("already been initialized")) throw e;
    clientInitialized = true;
  }
}

export async function withNafOracleConnection<T>(
  fn: (conn: oracledb.Connection) => Promise<T>,
): Promise<T> {
  const config = getNafOracleConfig();
  if (!config) {
    throw new Error(
      "Oracle NAF no configurado. Defina NAF_ORACLE_USER, NAF_ORACLE_PASSWORD y NAF_ORACLE_CONNECT_STRING.",
    );
  }
  initOracleClientIfNeeded(config.clientDir);
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  const conn = await oracledb.getConnection({
    user: config.user,
    password: config.password,
    connectString: config.connectString,
  });
  try {
    return await fn(conn);
  } finally {
    await conn.close();
  }
}
