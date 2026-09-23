import type { Session } from "next-auth";
import { hasPermission } from "@/lib/permissions/check";
import { prisma } from "@/modules/core/db/prisma";

/** ¿Hay editores configurados para este proceso? Si no, cualquier editor SIG global puede editar. */
export async function processHasEditors(processId: string | null | undefined): Promise<boolean> {
  if (!processId) return false;
  const n = await prisma.sigProcessEditor.count({ where: { processId } });
  return n > 0;
}

export async function isSigProcessEditor(
  userId: string,
  processId: string | null | undefined
): Promise<boolean> {
  if (!processId) return false;
  const row = await prisma.sigProcessEditor.findUnique({
    where: { processId_userId: { processId, userId } },
    select: { id: true },
  });
  return Boolean(row);
}

/**
 * Puede subir/editar contenido de un documento SIG.
 * - admin documentos → sí
 * - edit documentos + (sin editores en el proceso | usuario es editor | sin proceso) → sí
 * - solo biblioteca / aprobador → no (salvo admin)
 */
export async function canEditSigDocumentContent(
  session: Session | null | undefined,
  processId: string | null | undefined
): Promise<boolean> {
  if (!session) return false;
  if (hasPermission(session, "sig.documentos", "admin")) return true;
  if (!hasPermission(session, "sig.documentos", "edit")) return false;
  if (!processId) return true;
  const hasEditors = await processHasEditors(processId);
  if (!hasEditors) return true;
  return isSigProcessEditor(session.user.id, processId);
}

export async function assertCanEditSigDocument(
  session: Session,
  processId: string | null | undefined
) {
  const ok = await canEditSigDocumentContent(session, processId);
  if (!ok) {
    throw new Error(
      "No tiene permiso de edición para documentos de este proceso (solo editores asignados o admin)"
    );
  }
}

export async function listSigProcessEditors(processId: string) {
  return prisma.sigProcessEditor.findMany({
    where: { processId },
    orderBy: { createdAt: "asc" },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

export async function setSigProcessEditors(processId: string, userIds: string[]) {
  const process = await prisma.sigProcess.findUnique({
    where: { id: processId },
    select: { id: true },
  });
  if (!process) throw new Error("Proceso no encontrado");

  const unique = [...new Set(userIds.filter(Boolean))];
  await prisma.$transaction(async (tx) => {
    await tx.sigProcessEditor.deleteMany({ where: { processId } });
    if (unique.length) {
      await tx.sigProcessEditor.createMany({
        data: unique.map((userId) => ({ processId, userId })),
        skipDuplicates: true,
      });
    }
  });

  return listSigProcessEditors(processId);
}

export async function addSigProcessEditor(processId: string, userId: string) {
  await prisma.sigProcessEditor.upsert({
    where: { processId_userId: { processId, userId } },
    create: { processId, userId },
    update: {},
  });
  return listSigProcessEditors(processId);
}

export async function removeSigProcessEditor(processId: string, userId: string) {
  await prisma.sigProcessEditor.deleteMany({ where: { processId, userId } });
  return listSigProcessEditors(processId);
}
