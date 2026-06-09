import { PermissionLevel } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const APPROVER_LEVELS: PermissionLevel[] = [PermissionLevel.EDIT, PermissionLevel.ADMIN];

export type SigApproverUser = {
  id: string;
  name: string;
  email: string;
};

/** Usuarios activos con permiso sig.aprobaciones (edit o admin). */
export async function listSigApprovers(): Promise<SigApproverUser[]> {
  const rows = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [
        {
          roleEntity: {
            permissions: {
              some: {
                permissionKey: "sig.aprobaciones",
                level: { in: APPROVER_LEVELS },
              },
            },
          },
        },
        { role: "ADMIN" },
      ],
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });

  return rows;
}

export async function assertSigApproverUser(userId: string): Promise<SigApproverUser> {
  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      OR: [
        {
          roleEntity: {
            permissions: {
              some: {
                permissionKey: "sig.aprobaciones",
                level: { in: APPROVER_LEVELS },
              },
            },
          },
        },
        { role: "ADMIN" },
      ],
    },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    throw new Error("El aprobador seleccionado no tiene permiso de aprobación SIG");
  }

  return user;
}

export async function isAssignedSigApprover(versionId: string, userId: string): Promise<boolean> {
  const version = await prisma.sigDocumentVersion.findUnique({
    where: { id: versionId },
    select: { assignedApproverId: true, status: true },
  });
  if (!version || version.status !== "PENDING_APPROVAL") return false;
  if (!version.assignedApproverId) return false;
  return version.assignedApproverId === userId;
}
