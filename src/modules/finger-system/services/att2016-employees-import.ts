import { prisma } from "@/modules/core/db/prisma";
import { normalizeEmployeeCode } from "@/modules/disciplinario/business/disciplinary";
import { mdbExportTable } from "@/modules/finger-system/integrations/att2016/mdb-reader";
import { withAtt2016MdbRead } from "@/modules/finger-system/integrations/att2016/read-session";
import type {
  AttEmployeeImportPreview,
  AttEmployeePreviewRow,
  AttImportApplyResult,
  Att2016UserInfo,
} from "@/modules/finger-system/integrations/att2016/types";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";

function parseUserInfoRow(row: Record<string, string>): Att2016UserInfo | null {
  const attUserId = Number.parseInt(row.USERID ?? row.UserId ?? "", 10);
  const badgeRaw = row.Badgenumber ?? row.BADGENUMBER ?? row.SSN ?? "";
  const badgeNumber = normalizeEmployeeCode(badgeRaw) || String(badgeRaw).trim();
  if (!Number.isFinite(attUserId) || !badgeNumber) return null;

  const attFlag = row.ATT ?? row.att;
  const attEnabled = attFlag === undefined || attFlag === "" || attFlag === "1";

  return {
    attUserId,
    badgeNumber,
    name: row.Name?.trim() || row.NAME?.trim() || null,
    defaultDeptId: row.DEFAULTDEPTID ? Number.parseInt(row.DEFAULTDEPTID, 10) : null,
    attEnabled,
  };
}

export async function fetchAtt2016UserInfo(): Promise<Att2016UserInfo[]> {
  return withAtt2016MdbRead(async (mdb) => {
    const rows = await mdbExportTable(mdb, "USERINFO");
    return rows.map(parseUserInfoRow).filter((r): r is Att2016UserInfo => r != null);
  });
}

export async function previewAtt2016EmployeeImport(): Promise<AttEmployeeImportPreview> {
  const [attUsers, employees, links] = await Promise.all([
    fetchAtt2016UserInfo(),
    prisma.employee.findMany({
      select: {
        id: true,
        codigoEmpleado: true,
        nombre: true,
        fingerEmployeeLink: { select: { id: true, attUserId: true, badgeNumber: true } },
      },
    }),
    prisma.fingerEmployeeLink.findMany({
      select: { id: true, attUserId: true, badgeNumber: true, employeeId: true },
    }),
  ]);

  const employeeByCode = new Map<string, (typeof employees)[0]>();
  for (const e of employees) {
    const key = normalizeEmployeeCode(e.codigoEmpleado) || e.codigoEmpleado.trim();
    employeeByCode.set(key, e);
  }

  const linkByAttUserId = new Map(links.filter((l) => l.attUserId != null).map((l) => [l.attUserId!, l]));
  const linkByEmployeeId = new Map(links.map((l) => [l.employeeId, l]));

  let matchable = 0;
  let alreadyLinked = 0;
  let noAlfaMatch = 0;
  let conflict = 0;

  const previewRows: AttEmployeePreviewRow[] = attUsers.map((u) => {
    const emp = employeeByCode.get(u.badgeNumber);
    const existingByAtt = linkByAttUserId.get(u.attUserId);
    const existingByEmp = emp ? linkByEmployeeId.get(emp.id) : undefined;

    let matchStatus: AttEmployeePreviewRow["matchStatus"] = "no_alfa_match";
    if (existingByAtt && existingByAtt.employeeId === emp?.id) {
      matchStatus = "linked";
      alreadyLinked++;
    } else if (existingByAtt || (existingByEmp && existingByEmp.attUserId !== u.attUserId)) {
      matchStatus = "already_linked_other";
      conflict++;
    } else if (emp) {
      matchStatus = "matchable";
      matchable++;
    } else {
      noAlfaMatch++;
    }

    return {
      attUserId: u.attUserId,
      badgeNumber: u.badgeNumber,
      name: u.name,
      matchStatus,
      employeeId: emp?.id ?? null,
      employeeName: emp?.nombre ?? null,
      employeeCodigo: emp?.codigoEmpleado ?? null,
      existingLinkId: existingByAtt?.id ?? existingByEmp?.id ?? null,
    };
  });

  return {
    attTotal: attUsers.length,
    matchable,
    alreadyLinked,
    noAlfaMatch,
    conflict,
    rows: previewRows.sort((a, b) => a.badgeNumber.localeCompare(b.badgeNumber)),
  };
}

export async function applyAtt2016EmployeeImport(params: {
  userId: string;
  ipAddress?: string | null;
  onlyMatchable?: boolean;
}): Promise<AttImportApplyResult> {
  const preview = await previewAtt2016EmployeeImport();
  const toApply = preview.rows.filter((r) =>
    params.onlyMatchable !== false ? r.matchStatus === "matchable" : r.matchStatus !== "no_alfa_match",
  );

  const batch = await prisma.fingerImportBatch.create({
    data: {
      type: "att2016_employees",
      triggeredById: params.userId,
    },
  });

  let rowsInserted = 0;
  let rowsUpdated = 0;
  let rowsSkipped = 0;

  for (const row of toApply) {
    if (row.matchStatus !== "matchable" && row.matchStatus !== "linked") {
      rowsSkipped++;
      continue;
    }
    if (!row.employeeId) {
      rowsSkipped++;
      continue;
    }

    const attUser = preview.rows.find((r) => r.attUserId === row.attUserId);
    const existing = await prisma.fingerEmployeeLink.findUnique({
      where: { employeeId: row.employeeId },
    });

    if (existing) {
      await prisma.fingerEmployeeLink.update({
        where: { id: existing.id },
        data: {
          attUserId: row.attUserId,
          badgeNumber: row.badgeNumber,
          lastSyncAt: new Date(),
        },
      });
      rowsUpdated++;
    } else {
      const emp = await prisma.employee.findUnique({
        where: { id: row.employeeId },
        select: { company: true },
      });
      await prisma.fingerEmployeeLink.create({
        data: {
          employeeId: row.employeeId,
          attUserId: row.attUserId,
          badgeNumber: row.badgeNumber,
          company: emp?.company ?? null,
          lastSyncAt: new Date(),
        },
      });
      rowsInserted++;
    }
  }

  await prisma.fingerImportBatch.update({
    where: { id: batch.id },
    data: {
      rowsProcessed: toApply.length,
      rowsInserted,
      rowsUpdated,
      rowsSkipped,
      finishedAt: new Date(),
      detailJson: {
        attTotal: preview.attTotal,
        matchable: preview.matchable,
        noAlfaMatch: preview.noAlfaMatch,
      },
    },
  });

  await prisma.fingerSyncLog.create({
    data: {
      direction: "PULL",
      status: "SUCCESS",
      operation: "att2016_employees",
      message: `Importados ${rowsInserted} enlaces, actualizados ${rowsUpdated}.`,
      triggeredById: params.userId,
      finishedAt: new Date(),
      detailJson: { batchId: batch.id },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.import.att2016_employees",
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
