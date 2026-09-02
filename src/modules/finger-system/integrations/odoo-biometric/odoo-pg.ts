import { Prisma, PrismaClient } from "@prisma/client";

const ENV_KEY = "ODOO_BIOMETRIC_DATABASE_URL";

let odooClient: PrismaClient | null = null;

export function isOdooBiometricConfigured(): boolean {
  return Boolean(process.env[ENV_KEY]?.trim());
}

export function getOdooBiometricDatabaseUrl(): string | null {
  return process.env[ENV_KEY]?.trim() || null;
}

/** Cliente Prisma apuntando a Postgres de Odoo (solo $queryRaw / $executeRaw). */
export function getOdooBiometricClient(): PrismaClient {
  const url = getOdooBiometricDatabaseUrl();
  if (!url) {
    throw new Error(
      "ODOO_BIOMETRIC_DATABASE_URL no configurada. Defina la URL a Postgres de Odoo (syntradata).",
    );
  }
  if (!odooClient) {
    odooClient = new PrismaClient({
      datasources: { db: { url } },
      log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    });
  }
  return odooClient;
}

export async function odooBiometricQuery<T = unknown>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<T[]> {
  const client = getOdooBiometricClient();
  return client.$queryRaw<T[]>(Prisma.sql(strings, ...values));
}

export async function odooBiometricExecute(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<number> {
  const client = getOdooBiometricClient();
  return client.$executeRaw(Prisma.sql(strings, ...values));
}

export async function pingOdooBiometric(): Promise<{
  ok: boolean;
  message: string;
  punches?: number;
  devices?: number;
  users?: number;
}> {
  if (!isOdooBiometricConfigured()) {
    return { ok: false, message: "ODOO_BIOMETRIC_DATABASE_URL no configurada" };
  }
  try {
    const rows = await odooBiometricQuery<{
      devices: bigint | number;
      users: bigint | number;
      punches: bigint | number;
    }>`
      SELECT
        (SELECT COUNT(*) FROM alfa_biometric_device) AS devices,
        (SELECT COUNT(*) FROM alfa_biometric_user) AS users,
        (SELECT COUNT(*) FROM alfa_biometric_punch) AS punches
    `;
    const row = rows[0];
    return {
      ok: true,
      message: "OK",
      devices: Number(row?.devices ?? 0),
      users: Number(row?.users ?? 0),
      punches: Number(row?.punches ?? 0),
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : "Error al conectar con Odoo PG",
    };
  }
}
