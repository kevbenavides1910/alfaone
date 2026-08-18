import { prisma } from "@/modules/core/db/prisma";
import {
  mdbExportCheckInOutRange,
  parseAccessDateTime,
} from "@/modules/finger-system/integrations/att2016/mdb-reader";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";
import type { Att2016CheckInOut } from "@/modules/finger-system/integrations/att2016/types";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

function parseCheckRow(row: Record<string, string>): Att2016CheckInOut | null {
  const attUserId = Number.parseInt(row.USERID ?? "", 10);
  const checkTime = parseAccessDateTime(row.CHECKTIME);
  if (!Number.isFinite(attUserId) || !checkTime) return null;

  return {
    attUserId,
    checkTime,
    checkType: row.CHECKTYPE?.trim() || null,
    verifyCode: row.VERIFYCODE ? Number.parseInt(row.VERIFYCODE, 10) : null,
    sensorId: row.SENSORID?.trim() || null,
    workCode: row.WorkCode ? Number.parseInt(row.WorkCode, 10) : null,
    deviceSn: row.sn?.trim() || null,
  };
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function previewAtt2016PunchImport(fromInput: Date, toInput: Date): Promise<import("@/modules/finger-system/integrations/att2016/types").AttPunchImportPreview> {
  const from = startOfDay(fromInput);
  const to = startOfDay(toInput);
  if (from > to) {
    throw new Error("La fecha inicial no puede ser posterior a la fecha final.");
  }

  const punches = await withAtt2016MdbRead((mdb) => mdbExportCheckInOutRange(mdb, from, to));
  const parsed = punches.map(parseCheckRow).filter((p): p is Att2016CheckInOut => p != null);

  const links = await prisma.fingerEmployeeLink.findMany({
    select: {
      attUserId: true,
      badgeNumber: true,
      employeeId: true,
      employee: { select: { nombre: true } },
    },
  });
  const linkByAttUserId = new Map(
    links.filter((l) => l.attUserId != null).map((l) => [l.attUserId!, l]),
  );

  let alreadyImported = 0;
  for (let i = 0; i < parsed.length; i += 500) {
    const chunk = parsed.slice(i, i + 500);
    if (chunk.length === 0) continue;
    const existing = await prisma.fingerPunch.findMany({
      where: {
        OR: chunk.map((p) => ({ attUserId: p.attUserId, checkTime: p.checkTime })),
      },
      select: { attUserId: true, checkTime: true },
    });
    alreadyImported += existing.length;
  }

  const newRows = parsed.length - alreadyImported;
  let unlinkedPunches = 0;
  for (const p of parsed) {
    if (!linkByAttUserId.has(p.attUserId)) unlinkedPunches++;
  }

  const sample = parsed.slice(0, 10).map((p) => {
    const link = linkByAttUserId.get(p.attUserId);
    return {
      checkTime: p.checkTime.toISOString(),
      badgeNumber: link?.badgeNumber ?? null,
      employeeName: link?.employee?.nombre ?? null,
      checkType: p.checkType,
      deviceSn: p.deviceSn,
    };
  });

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    rowsInRange: parsed.length,
    alreadyImported,
    newRows,
    unlinkedPunches,
    sample,
  };
}

export async function applyAtt2016PunchImport(params: {
  userId?: string | null;
  from: Date;
  to: Date;
  ipAddress?: string | null;
}): Promise<import("@/modules/finger-system/integrations/att2016/types").AttImportApplyResult> {
  const from = startOfDay(params.from);
  const to = startOfDay(params.to);

  const punches = await withAtt2016MdbRead((mdb) => mdbExportCheckInOutRange(mdb, from, to));
  const parsed = punches.map(parseCheckRow).filter((p): p is Att2016CheckInOut => p != null);

  const links = await prisma.fingerEmployeeLink.findMany({
    select: { attUserId: true, badgeNumber: true, employeeId: true },
  });
  const linkByAttUserId = new Map(
    links.filter((l) => l.attUserId != null).map((l) => [l.attUserId!, l]),
  );

  const batch = await prisma.fingerImportBatch.create({
    data: {
      type: "att2016_punches",
      triggeredById: params.userId ?? null,
    },
  });

  let rowsInserted = 0;
  let rowsSkipped = 0;

  const chunkSize = 200;
  for (let i = 0; i < parsed.length; i += chunkSize) {
    const chunk = parsed.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(async (p) => {
        const link = linkByAttUserId.get(p.attUserId);
        try {
          await prisma.fingerPunch.create({
            data: {
              attUserId: p.attUserId,
              badgeNumber: link?.badgeNumber ?? null,
              checkTime: p.checkTime,
              checkType: p.checkType,
              verifyCode: p.verifyCode,
              sensorId: p.sensorId,
              workCode: p.workCode,
              deviceSn: p.deviceSn,
              employeeId: link?.employeeId ?? null,
              importBatchId: batch.id,
            },
          });
          return "inserted" as const;
        } catch {
          return "skipped" as const;
        }
      }),
    );
    for (const r of results) {
      if (r === "inserted") rowsInserted++;
      else rowsSkipped++;
    }
  }

  await prisma.fingerImportBatch.update({
    where: { id: batch.id },
    data: {
      rowsProcessed: parsed.length,
      rowsInserted,
      rowsSkipped,
      finishedAt: new Date(),
      detailJson: { from: from.toISOString(), to: to.toISOString() },
    },
  });

  await prisma.fingerSyncLog.create({
    data: {
      direction: "PULL",
      status: rowsInserted > 0 ? "SUCCESS" : "PARTIAL",
      operation: "att2016_punches",
      message: `Marcas importadas: ${rowsInserted} nuevas, ${rowsSkipped} omitidas.`,
      triggeredById: params.userId ?? null,
      finishedAt: new Date(),
      detailJson: { batchId: batch.id, from, to },
    },
  });

  await logFingerOperation({
    userId: params.userId ?? null,
    action: "finger.import.att2016_punches",
    entityType: "FingerImportBatch",
    entityId: batch.id,
    ipAddress: params.ipAddress ?? null,
    metadata: { rowsInserted, rowsSkipped, from, to },
  });

  return {
    batchId: batch.id,
    rowsProcessed: parsed.length,
    rowsInserted,
    rowsUpdated: 0,
    rowsSkipped,
  };
}

export async function countFingerPunchesToday(): Promise<number> {
  const start = startOfDay(new Date());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return prisma.fingerPunch.count({
    where: { checkTime: { gte: start, lt: end } },
  });
}
