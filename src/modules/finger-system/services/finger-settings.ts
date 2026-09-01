import { prisma } from "@/modules/core/db/prisma";
import { Prisma } from "@prisma/client";
import { FINGER_ENV } from "@/modules/finger-system/config/finger.config";
import {
  buildWindowsPathFromParts,
  normalizeAttDriveMappings,
  resolveAttDatabasePath,
} from "@/modules/finger-system/integrations/att2016/path-resolver";
import type { AttDriveMapping } from "@/modules/finger-system/integrations/att2016/path-resolver";
import { encryptFingerSmbPassword } from "@/modules/finger-system/utils/finger-smb-crypto";

export async function ensureFingerSettingsRow() {
  return prisma.appFingerSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      attReadOnly: true,
      attSmbShare: FINGER_ENV.attSmbShare(),
      attDatabaseName: FINGER_ENV.attDatabaseName(),
      attWindowsPath: buildWindowsPathFromParts({
        driveLetter: "X",
        databaseName: FINGER_ENV.attDatabaseName(),
      }),
      attAccessUser: "Admin",
      attBlankPassword: true,
    },
    update: {},
  });
}

export async function getFingerSettingsPublic() {
  const row = await ensureFingerSettingsRow();
  return {
    attReadOnly: row.attReadOnly,
    attConnectionType: row.attConnectionType,
    attSmbShare: row.attSmbShare,
    attSmbUser: row.attSmbUser,
    attSmbPasswordSet: Boolean(row.attSmbPasswordEnc),
    attDatabaseName: row.attDatabaseName,
    attWindowsPath:
      row.attWindowsPath ??
      buildWindowsPathFromParts({
        driveLetter: "X",
        databaseName: row.attDatabaseName ?? "ATT2016.MDB",
        smbShare: row.attSmbShare,
      }),
    attAccessUser: row.attAccessUser ?? "Admin",
    attBlankPassword: row.attBlankPassword ?? true,
    attDriveMappings: row.attDriveMappings,
    linkRrhhEmployees: row.linkRrhhEmployees,
    syncAutoEnabled: row.syncAutoEnabled,
    syncIntervalMinutes: row.syncIntervalMinutes,
    lastAutoSyncAt: row.lastAutoSyncAt?.toISOString() ?? null,
    discoveryDefaultPort: row.discoveryDefaultPort,
    backupPath: row.backupPath,
    updatedAt: row.updatedAt.toISOString(),
    smbConfigured: Boolean(row.attSmbPasswordEnc) || Boolean(FINGER_ENV.attConnectionString()),
  };
}

export type FingerSettingsPatch = {
  attReadOnly?: boolean;
  linkRrhhEmployees?: boolean;
  syncAutoEnabled?: boolean;
  syncIntervalMinutes?: number;
  discoveryDefaultPort?: number;
  backupPath?: string | null;
  attSmbShare?: string | null;
  attSmbUser?: string | null;
  attSmbPassword?: string | null;
  clearAttSmbPassword?: boolean;
  attDatabaseName?: string | null;
  attWindowsPath?: string | null;
  attAccessUser?: string | null;
  attBlankPassword?: boolean;
  attDriveMappings?: AttDriveMapping[] | null;
};

function normalizeSmbShare(input: string | null | undefined): string | null {
  const value = input?.trim();
  if (!value) return null;
  if (!/^\/\/[^/\\s]+\/[^/\\s]+/.test(value)) {
    throw new Error(
      "Share SMB inválido. Use formato //servidor/carpeta (ej. //10.1.1.3/DB-Biometrico).",
    );
  }
  return value;
}

function normalizeDatabaseFile(input: string | null | undefined): string | null {
  const value = input?.trim();
  if (!value) return null;
  if (/[/\\]/.test(value) || value.includes("..")) {
    throw new Error("Nombre de archivo MDB inválido. Solo el nombre del archivo (ej. ATT2016.MDB).");
  }
  return value;
}

export async function updateFingerSettings(patch: FingerSettingsPatch) {
  const data: Prisma.AppFingerSettingsUpdateInput = {};

  if (patch.attReadOnly !== undefined) data.attReadOnly = patch.attReadOnly;
  if (patch.linkRrhhEmployees !== undefined) data.linkRrhhEmployees = patch.linkRrhhEmployees;
  if (patch.syncAutoEnabled !== undefined) data.syncAutoEnabled = patch.syncAutoEnabled;
  if (patch.syncIntervalMinutes !== undefined) {
    const mins = Math.min(1440, Math.max(5, Math.round(patch.syncIntervalMinutes)));
    data.syncIntervalMinutes = mins;
  }
  if (patch.discoveryDefaultPort !== undefined) {
    const port = Math.min(65535, Math.max(1, Math.round(patch.discoveryDefaultPort)));
    data.discoveryDefaultPort = port;
  }
  if (patch.backupPath !== undefined) data.backupPath = patch.backupPath?.trim() || null;

  const row = await ensureFingerSettingsRow();
  const mappings = patch.attDriveMappings ?? row.attDriveMappings;

  if (patch.attWindowsPath !== undefined) {
    const path = patch.attWindowsPath?.trim();
    if (!path) {
      data.attWindowsPath = null;
    } else {
      const resolved = resolveAttDatabasePath(path, mappings);
      data.attWindowsPath = resolved.windowsPath;
      data.attSmbShare = resolved.smbShare;
      data.attDatabaseName = resolved.databaseName;
    }
  } else {
    if (patch.attSmbShare !== undefined) data.attSmbShare = normalizeSmbShare(patch.attSmbShare);
    if (patch.attDatabaseName !== undefined) {
      data.attDatabaseName = normalizeDatabaseFile(patch.attDatabaseName);
    }
  }

  if (patch.attAccessUser !== undefined) data.attAccessUser = patch.attAccessUser?.trim() || "Admin";
  if (patch.attBlankPassword !== undefined) data.attBlankPassword = patch.attBlankPassword;
  if (patch.attDriveMappings !== undefined) {
    data.attDriveMappings =
      patch.attDriveMappings === null
        ? Prisma.JsonNull
        : (normalizeAttDriveMappings(patch.attDriveMappings) as Prisma.InputJsonValue);
  }

  if (patch.attSmbUser !== undefined) {
    data.attSmbUser = patch.attSmbUser?.trim() || null;
  }
  if (patch.clearAttSmbPassword) {
    data.attSmbPasswordEnc = null;
  } else if (typeof patch.attSmbPassword === "string" && patch.attSmbPassword.trim()) {
    data.attSmbPasswordEnc = encryptFingerSmbPassword(patch.attSmbPassword.trim());
  }

  await prisma.appFingerSettings.update({
    where: { id: "default" },
    data,
  });

  return getFingerSettingsPublic();
}
