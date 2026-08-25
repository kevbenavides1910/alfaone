import { prisma } from "@/modules/core/db/prisma";
import { mdbExportTable } from "@/modules/finger-system/integrations/att2016/mdb-reader";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";
import type { Att2016Machine } from "@/modules/finger-system/integrations/att2016/types";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

function parseMachineRow(row: Record<string, string>): Att2016Machine | null {
  const id = Number.parseInt(row.ID ?? row.id ?? "", 10);
  const alias = row.MachineAlias?.trim() || row.MACHINEALIAS?.trim() || "";
  if (!Number.isFinite(id) || !alias) return null;

  const portRaw = row.Port ?? row.port;
  const port = portRaw ? Number.parseInt(portRaw, 10) : 4370;
  const enabledRaw = row.Enabled ?? row.enabled;
  const enabled = enabledRaw === undefined || enabledRaw === "" || enabledRaw === "1";

  return {
    id,
    alias,
    ip: row.IP?.trim() || row.ip?.trim() || null,
    port: Number.isFinite(port) ? port : 4370,
    serialNumber: row.sn?.trim() || row.SN?.trim() || null,
    enabled,
  };
}

export async function fetchAtt2016Machines(): Promise<Att2016Machine[]> {
  return withAtt2016MdbRead(async (mdb) => {
    const rows = await mdbExportTable(mdb, "Machines");
    return rows.map(parseMachineRow).filter((r): r is Att2016Machine => r != null);
  });
}

export type AttMachineImportPreview = {
  attTotal: number;
  importable: number;
  missingIp: number;
  alreadyRegistered: number;
  rows: {
    attId: number;
    alias: string;
    ip: string | null;
    port: number | null;
    serialNumber: string | null;
    enabled: boolean;
    existingDeviceId: string | null;
    importStatus: "new" | "update" | "skip_no_ip" | "already_synced";
  }[];
};

export async function previewAtt2016MachineImport(): Promise<AttMachineImportPreview> {
  const [machines, devices] = await Promise.all([
    fetchAtt2016Machines(),
    prisma.fingerDevice.findMany({
      select: { id: true, ipAddress: true, serialNumber: true, name: true },
    }),
  ]);

  const byIp = new Map(devices.map((d) => [d.ipAddress, d]));
  const bySerial = new Map(
    devices.filter((d) => d.serialNumber).map((d) => [d.serialNumber!, d]),
  );

  let importable = 0;
  let missingIp = 0;
  let alreadyRegistered = 0;

  const rows = machines.map((m) => {
    let importStatus: AttMachineImportPreview["rows"][0]["importStatus"] = "new";
    let existingDeviceId: string | null = null;

    if (!m.ip) {
      importStatus = "skip_no_ip";
      missingIp++;
    } else {
      const byIpMatch = byIp.get(m.ip);
      const bySnMatch = m.serialNumber ? bySerial.get(m.serialNumber) : undefined;
      const existing = byIpMatch ?? bySnMatch;
      if (existing) {
        existingDeviceId = existing.id;
        if (existing.name === m.alias) {
          importStatus = "already_synced";
          alreadyRegistered++;
        } else {
          importStatus = "update";
          importable++;
        }
      } else {
        importable++;
      }
    }

    return {
      attId: m.id,
      alias: m.alias,
      ip: m.ip,
      port: m.port,
      serialNumber: m.serialNumber,
      enabled: m.enabled,
      existingDeviceId,
      importStatus,
    };
  });

  return {
    attTotal: machines.length,
    importable,
    missingIp,
    alreadyRegistered,
    rows: rows.sort((a, b) => a.alias.localeCompare(b.alias)),
  };
}

export async function applyAtt2016MachineImport(params: {
  userId: string;
  ipAddress?: string | null;
}) {
  const preview = await previewAtt2016MachineImport();
  const toApply = preview.rows.filter((r) => r.importStatus !== "skip_no_ip");

  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;

  for (const row of toApply) {
    if (row.importStatus === "already_synced") {
      rowsSkipped++;
      continue;
    }
    if (!row.ip) {
      rowsSkipped++;
      continue;
    }

    if (row.existingDeviceId) {
      await prisma.fingerDevice.update({
        where: { id: row.existingDeviceId },
        data: {
          name: row.alias,
          ipAddress: row.ip,
          port: row.port ?? 4370,
          serialNumber: row.serialNumber,
          isActive: row.enabled,
        },
      });
      rowsUpdated++;
    } else {
      await prisma.fingerDevice.create({
        data: {
          name: row.alias,
          ipAddress: row.ip,
          port: row.port ?? 4370,
          serialNumber: row.serialNumber,
          brand: "ZKTeco",
          isActive: row.enabled,
        },
      });
      rowsInserted++;
    }
  }

  const batch = await prisma.fingerImportBatch.create({
    data: {
      type: "att2016_machines",
      rowsProcessed: toApply.length,
      rowsInserted,
      rowsUpdated,
      rowsSkipped,
      finishedAt: new Date(),
      triggeredById: params.userId,
      detailJson: { attTotal: preview.attTotal, importable: preview.importable },
    },
  });

  await prisma.fingerSyncLog.create({
    data: {
      direction: "PULL",
      status: "SUCCESS",
      operation: "att2016_machines",
      message: `Importados ${rowsInserted} dispositivos, actualizados ${rowsUpdated}.`,
      triggeredById: params.userId,
      finishedAt: new Date(),
      detailJson: { batchId: batch.id },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.import.att2016_machines",
    entityType: "FingerImportBatch",
    entityId: batch.id,
    ipAddress: params.ipAddress ?? null,
    metadata: { rowsInserted, rowsUpdated, rowsSkipped },
  });

  return {
    batchId: batch.id,
    rowsProcessed: toApply.length,
    rowsInserted,
    rowsUpdated,
    rowsSkipped,
  };
}
