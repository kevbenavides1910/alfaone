/** Variables de entorno para integración ATT2016 (secretos fuera de BD). */
export const FINGER_ENV = {
  attSmbShare: () =>
    process.env.ATT2016_SMB_SHARE?.trim() || "//10.1.1.3/DB-Biometrico",
  attSmbUser: () =>
    process.env.ATT2016_SMB_USER?.trim() ||
    process.env.NAF_SMB_USER?.trim() ||
    "",
  attSmbPassword: () =>
    process.env.ATT2016_SMB_PASSWORD?.trim() ||
    process.env.NAF_SMB_PASSWORD?.trim() ||
    "",
  attDatabaseName: () => process.env.ATT2016_DATABASE_FILE?.trim() || process.env.ATT2016_DATABASE_NAME?.trim() || "ATT2016.MDB",
  attConnectionString: () => process.env.ATT2016_CONNECTION_STRING?.trim() || "",
} as const;

export const FINGER_BRAND = {
  name: "Finger System",
  tagline: "Administración de asistencia biométrica",
  primaryHex: "#0d9488",
  accentHex: "#134e4a",
} as const;
