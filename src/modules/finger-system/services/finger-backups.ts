import { copyFile, mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/modules/core/db/prisma";
import { fetchAtt2016MdbCopy } from "@/modules/finger-system/integrations/att2016/smb-client";
import { ensureFingerSettingsRow } from "@/modules/finger-system/services/finger-settings";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

export type FingerBackupEntry = {
  folderName: string;
  path: string;
  createdAt: string;
  sizeBytes: number;
  files: string[];
};

function formatBackupFolderName(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  return `FingerSystem_${y}-${m}-${day}_${h}${min}${s}`;
}

export async function resolveFingerBackupRoot(): Promise<string> {
  const settings = await ensureFingerSettingsRow();
  if (settings.backupPath?.trim()) {
    return settings.backupPath.trim();
  }
  const dataRoot = process.env.APP_DATA_ROOT?.trim() || "/data";
  return path.join(dataRoot, "finger-backups");
}

export async function listFingerBackups(): Promise<{
  root: string;
  items: FingerBackupEntry[];
}> {
  const root = await resolveFingerBackupRoot();
  await mkdir(root, { recursive: true });

  const entries = await readdir(root, { withFileTypes: true });
  const items: FingerBackupEntry[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith("FingerSystem_")) continue;
    const fullPath = path.join(root, entry.name);
    const files = await readdir(fullPath);
    let sizeBytes = 0;
    for (const f of files) {
      const st = await stat(path.join(fullPath, f));
      sizeBytes += st.size;
    }
    const stDir = await stat(fullPath);
    items.push({
      folderName: entry.name,
      path: fullPath,
      createdAt: stDir.mtime.toISOString(),
      sizeBytes,
      files,
    });
  }

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { root, items };
}

export async function createFingerAtt2016Backup(params: {
  userId: string;
  ipAddress?: string | null;
}): Promise<FingerBackupEntry> {
  const root = await resolveFingerBackupRoot();
  await mkdir(root, { recursive: true });

  const now = new Date();
  const folderName = formatBackupFolderName(now);
  const destDir = path.join(root, folderName);
  await mkdir(destDir, { recursive: true });

  const { localPath, cleanup } = await fetchAtt2016MdbCopy();
  try {
    const settings = await ensureFingerSettingsRow();
    const dbFileName = settings.attDatabaseName?.trim() || "ATT2016.MDB";
    const destFile = path.join(destDir, dbFileName.replace(/[/\\]/g, "_"));
    await copyFile(localPath, destFile);

    const manifest = {
      createdAt: now.toISOString(),
      source: "ATT2016_SMB",
      databaseFile: dbFileName,
      createdByUserId: params.userId,
    };
    await writeFile(path.join(destDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");

    const st = await stat(destFile);
    const entry: FingerBackupEntry = {
      folderName,
      path: destDir,
      createdAt: now.toISOString(),
      sizeBytes: st.size,
      files: [path.basename(destFile), "manifest.json"],
    };

    await prisma.fingerSyncLog.create({
      data: {
        direction: "PULL",
        status: "SUCCESS",
        operation: "att2016_backup",
        message: `Respaldo ${folderName} (${Math.round(st.size / 1024)} KB).`,
        triggeredById: params.userId,
        finishedAt: now,
        detailJson: { folderName, path: destDir, sizeBytes: st.size },
      },
    });

    await logFingerOperation({
      userId: params.userId,
      action: "finger.backup.att2016",
      entityType: "FingerBackup",
      entityId: folderName,
      ipAddress: params.ipAddress ?? null,
      metadata: { folderName, sizeBytes: st.size },
    });

    return entry;
  } finally {
    await cleanup();
  }
}

export async function readFingerBackupManifest(folderName: string): Promise<Record<string, unknown> | null> {
  const root = await resolveFingerBackupRoot();
  const manifestPath = path.join(root, folderName, "manifest.json");
  try {
    const raw = await readFile(manifestPath, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Restaura ATT2016.MDB desde un respaldo local (requiere attReadOnly=false y confirmación). */
export async function restoreFingerAtt2016Backup(params: {
  folderName: string;
  confirmToken: string;
  userId: string;
  ipAddress?: string | null;
}): Promise<{ restored: true; preBackupFolder: string; databaseFile: string }> {
  if (params.confirmToken !== params.folderName) {
    throw new Error("Token de confirmación inválido. Escriba exactamente el nombre de la carpeta del respaldo.");
  }

  const settings = await prisma.appFingerSettings.findUnique({ where: { id: "default" } });
  if (settings?.attReadOnly !== false) {
    throw new Error(
      "La base biométrica está en modo solo lectura. Desactive attReadOnly en configuración antes de restaurar.",
    );
  }

  const root = await resolveFingerBackupRoot();
  const backupDir = path.join(root, params.folderName);
  const manifest = await readFingerBackupManifest(params.folderName);
  if (!manifest) {
    throw new Error("Respaldo no encontrado o manifest.json inválido.");
  }

  const dbFileName = (manifest.databaseFile as string) || settings?.attDatabaseName?.trim() || "ATT2016.MDB";
  const mdbPath = path.join(backupDir, dbFileName.replace(/[/\\]/g, "_"));
  try {
    const st = await stat(mdbPath);
    if (st.size < 1024) throw new Error("Archivo MDB del respaldo demasiado pequeño.");
  } catch {
    throw new Error(`No se encontró ${path.basename(mdbPath)} en el respaldo.`);
  }

  const preBackup = await createFingerAtt2016Backup({
    userId: params.userId,
    ipAddress: params.ipAddress ?? null,
  });

  const { uploadAtt2016MdbCopy } = await import(
    "@/modules/finger-system/integrations/att2016/smb-client"
  );
  await uploadAtt2016MdbCopy(mdbPath);

  await prisma.fingerSyncLog.create({
    data: {
      direction: "PUSH",
      status: "SUCCESS",
      operation: "att2016_restore",
      message: `Restaurado desde ${params.folderName} (pre-backup: ${preBackup.folderName}).`,
      triggeredById: params.userId,
      finishedAt: new Date(),
      detailJson: {
        folderName: params.folderName,
        preBackupFolder: preBackup.folderName,
        databaseFile: dbFileName,
      },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.restore.att2016",
    entityType: "FingerBackup",
    entityId: params.folderName,
    ipAddress: params.ipAddress ?? null,
    metadata: { preBackupFolder: preBackup.folderName },
  });

  return { restored: true, preBackupFolder: preBackup.folderName, databaseFile: dbFileName };
}
