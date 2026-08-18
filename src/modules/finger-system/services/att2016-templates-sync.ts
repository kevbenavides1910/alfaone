import { prisma } from "@/modules/core/db/prisma";
import type { Prisma } from "@prisma/client";
import { mdbExportTemplateMeta } from "@/modules/finger-system/integrations/att2016/mdb-reader";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";
import type { Att2016TemplateFinger, AttTemplateSyncPreview } from "@/modules/finger-system/integrations/att2016/types";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

export { fingerLabel } from "@/modules/finger-system/config/finger-biometrics.client";

export async function fetchAtt2016TemplateMeta(): Promise<Att2016TemplateFinger[]> {
  return withAtt2016MdbRead(async (mdb) => mdbExportTemplateMeta(mdb));
}

function groupByUserId(rows: Att2016TemplateFinger[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const row of rows) {
    const list = map.get(row.attUserId) ?? [];
    list.push(row.fingerId);
    map.set(row.attUserId, list);
  }
  for (const [uid, ids] of map) {
    map.set(uid, [...new Set(ids)].sort((a, b) => a - b));
  }
  return map;
}

export async function previewAtt2016TemplateSync(): Promise<AttTemplateSyncPreview> {
  const [templates, links] = await Promise.all([
    fetchAtt2016TemplateMeta(),
    prisma.fingerEmployeeLink.findMany({
      select: {
        id: true,
        attUserId: true,
        badgeNumber: true,
        fingerprintCount: true,
        employee: { select: { nombre: true, codigoEmpleado: true } },
      },
      orderBy: { employee: { nombre: "asc" } },
    }),
  ]);

  const byUserId = groupByUserId(templates);
  const linkedAttIds = new Set(links.filter((l) => l.attUserId != null).map((l) => l.attUserId!));

  let withFingerprints = 0;
  let withoutFingerprints = 0;
  let unlinkedAttUsers = 0;

  const previewRows: AttTemplateSyncPreview["rows"] = links.map((link) => {
    if (!link.attUserId) {
      withoutFingerprints++;
      return {
        linkId: link.id,
        attUserId: null,
        badgeNumber: link.badgeNumber,
        employeeName: link.employee.nombre,
        employeeCodigo: link.employee.codigoEmpleado,
        fingerprintCount: 0,
        fingerIds: [],
        syncStatus: "no_att_user" as const,
      };
    }

    const fingerIds = byUserId.get(link.attUserId) ?? [];
    const syncStatus = fingerIds.length > 0 ? ("synced" as const) : ("no_templates" as const);
    if (fingerIds.length > 0) withFingerprints++;
    else withoutFingerprints++;

    return {
      linkId: link.id,
      attUserId: link.attUserId,
      badgeNumber: link.badgeNumber,
      employeeName: link.employee.nombre,
      employeeCodigo: link.employee.codigoEmpleado,
      fingerprintCount: fingerIds.length,
      fingerIds,
      syncStatus,
    };
  });

  for (const attUserId of byUserId.keys()) {
    if (!linkedAttIds.has(attUserId)) unlinkedAttUsers++;
  }

  return {
    attTemplateRows: templates.length,
    linkedEmployees: links.length,
    withFingerprints,
    withoutFingerprints,
    unlinkedAttUsers,
    rows: previewRows,
  };
}

export async function applyAtt2016TemplateSync(params: {
  userId: string;
  ipAddress?: string | null;
}) {
  const preview = await previewAtt2016TemplateSync();
  const now = new Date();

  let rowsUpdated = 0;
  let rowsSkipped = 0;

  for (const row of preview.rows) {
    if (!row.linkId || !row.attUserId) {
      rowsSkipped++;
      continue;
    }

    await prisma.fingerEmployeeLink.update({
      where: { id: row.linkId },
      data: {
        fingerprintCount: row.fingerprintCount,
        lastSyncAt: now,
      },
    });
    rowsUpdated++;
  }

  const batch = await prisma.fingerImportBatch.create({
    data: {
      type: "att2016_templates",
      rowsProcessed: preview.rows.length,
      rowsInserted: 0,
      rowsUpdated,
      rowsSkipped,
      finishedAt: now,
      triggeredById: params.userId,
      detailJson: {
        attTemplateRows: preview.attTemplateRows,
        withFingerprints: preview.withFingerprints,
        withoutFingerprints: preview.withoutFingerprints,
      },
    },
  });

  await prisma.fingerSyncLog.create({
    data: {
      direction: "PULL",
      status: "SUCCESS",
      operation: "att2016_templates",
      message: `Actualizados ${rowsUpdated} contadores de huella desde ATT2016.`,
      triggeredById: params.userId,
      finishedAt: now,
      detailJson: { batchId: batch.id, attTemplateRows: preview.attTemplateRows },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.sync.att2016_templates",
    entityType: "FingerImportBatch",
    entityId: batch.id,
    ipAddress: params.ipAddress ?? null,
    metadata: { rowsUpdated, attTemplateRows: preview.attTemplateRows },
  });

  return {
    batchId: batch.id,
    rowsProcessed: preview.rows.length,
    rowsInserted: 0,
    rowsUpdated,
    rowsSkipped,
    attTemplateRows: preview.attTemplateRows,
  };
}

export type FingerBiometricListFilters = {
  q?: string;
  hasFingerprints?: boolean;
  page?: number;
  pageSize?: number;
};

export async function listFingerBiometrics(filters: FingerBiometricListFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));
  const skip = (page - 1) * pageSize;

  const where: Prisma.FingerEmployeeLinkWhereInput = {};

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    where.OR = [
      { badgeNumber: { contains: q, mode: "insensitive" } },
      { employee: { codigoEmpleado: { contains: q, mode: "insensitive" } } },
      { employee: { nombre: { contains: q, mode: "insensitive" } } },
    ];
  }

  if (filters.hasFingerprints === true) {
    where.fingerprintCount = { gt: 0 };
  } else if (filters.hasFingerprints === false) {
    where.fingerprintCount = 0;
  }

  const [total, rows] = await Promise.all([
    prisma.fingerEmployeeLink.count({ where }),
    prisma.fingerEmployeeLink.findMany({
      where,
      orderBy: [{ employee: { nombre: "asc" } }],
      skip,
      take: pageSize,
      select: {
        id: true,
        attUserId: true,
        badgeNumber: true,
        fingerprintCount: true,
        lastSyncAt: true,
        employee: { select: { nombre: true, codigoEmpleado: true } },
      },
    }),
  ]);

  return {
    items: rows.map((r) => ({
      linkId: r.id,
      attUserId: r.attUserId,
      badgeNumber: r.badgeNumber,
      employeeName: r.employee.nombre,
      employeeCodigo: r.employee.codigoEmpleado,
      fingerprintCount: r.fingerprintCount,
      lastSyncAt: r.lastSyncAt?.toISOString() ?? null,
      status:
        r.fingerprintCount > 0
          ? ("registered" as const)
          : r.attUserId
            ? ("pending" as const)
            : ("unlinked" as const),
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
