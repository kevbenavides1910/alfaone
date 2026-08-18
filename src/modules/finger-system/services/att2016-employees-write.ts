import { prisma } from "@/modules/core/db/prisma";
import {
  mdbInsertUserInfo,
  mdbUpdateUserInfo,
} from "@/modules/finger-system/integrations/att2016/mdb-reader";
import { withAtt2016MdbWrite } from "@/modules/finger-system/integrations/att2016/write-session";
import { logFingerOperation } from "@/modules/finger-system/services/finger-audit";
import {
  allocateNextAttUserId,
  assertAttWriteAllowed,
  validateBadgeInAtt2016,
} from "@/modules/finger-system/services/att2016-userid";

export type AttUserInfoWriteResult = {
  attUserId: number;
  badgeNumber: string;
  name: string;
};

export async function insertAtt2016UserInfo(params: {
  badgeNumber: string;
  name: string;
  defaultDeptId?: number;
  userId: string;
  ipAddress?: string | null;
}): Promise<AttUserInfoWriteResult> {
  await assertAttWriteAllowed();

  const badgeCheck = await validateBadgeInAtt2016(params.badgeNumber);
  if (!badgeCheck.ok) {
    throw new Error(badgeCheck.message);
  }

  const attUserId = await allocateNextAttUserId();

  await withAtt2016MdbWrite(async (mdb) => {
    await mdbInsertUserInfo(mdb, {
      attUserId,
      badgeNumber: params.badgeNumber,
      name: params.name,
      defaultDeptId: params.defaultDeptId ?? 1,
    });
  });

  await prisma.fingerSyncLog.create({
    data: {
      direction: "PUSH",
      status: "SUCCESS",
      operation: "att2016_userinfo_insert",
      message: `Alta USERID ${attUserId}, badge ${params.badgeNumber}.`,
      triggeredById: params.userId,
      finishedAt: new Date(),
      detailJson: { attUserId, badgeNumber: params.badgeNumber },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.att2016.userinfo.insert",
    entityType: "USERINFO",
    entityId: String(attUserId),
    ipAddress: params.ipAddress ?? null,
    metadata: { badgeNumber: params.badgeNumber, name: params.name },
  });

  return { attUserId, badgeNumber: params.badgeNumber, name: params.name };
}

export async function updateAtt2016UserInfo(params: {
  attUserId: number;
  badgeNumber?: string;
  name?: string;
  attEnabled?: boolean;
  userId: string;
  ipAddress?: string | null;
}): Promise<void> {
  await assertAttWriteAllowed();

  if (params.badgeNumber) {
    const badgeCheck = await validateBadgeInAtt2016(params.badgeNumber, params.attUserId);
    if (!badgeCheck.ok) {
      throw new Error(badgeCheck.message);
    }
  }

  await withAtt2016MdbWrite(async (mdb) => {
    await mdbUpdateUserInfo(mdb, {
      attUserId: params.attUserId,
      badgeNumber: params.badgeNumber,
      name: params.name,
      attEnabled: params.attEnabled,
    });
  });

  await prisma.fingerSyncLog.create({
    data: {
      direction: "PUSH",
      status: "SUCCESS",
      operation: "att2016_userinfo_update",
      message: `Actualizado USERID ${params.attUserId}.`,
      triggeredById: params.userId,
      finishedAt: new Date(),
      detailJson: {
        attUserId: params.attUserId,
        badgeNumber: params.badgeNumber ?? null,
        name: params.name ?? null,
      },
    },
  });

  await logFingerOperation({
    userId: params.userId,
    action: "finger.att2016.userinfo.update",
    entityType: "USERINFO",
    entityId: String(params.attUserId),
    ipAddress: params.ipAddress ?? null,
    metadata: {
      badgeNumber: params.badgeNumber ?? null,
      name: params.name ?? null,
    },
  });
}
