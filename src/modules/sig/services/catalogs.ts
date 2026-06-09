import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

export function normalizeSigCatalogCode(code: string) {
  const normalized = code.trim().toUpperCase().replace(/\s+/g, "_").slice(0, 60);
  if (!normalized) throw new Error("Código requerido");
  return normalized;
}

async function assertUniqueProcessCode(code: string, excludeId?: string) {
  const existing = await prisma.sigProcess.findUnique({ where: { code } });
  if (existing && existing.id !== excludeId) {
    throw new Error(`Ya existe un proceso con código ${code}`);
  }
}

async function assertUniqueDocumentTypeCode(code: string, excludeId?: string) {
  const existing = await prisma.sigDocumentType.findUnique({ where: { code } });
  if (existing && existing.id !== excludeId) {
    throw new Error(`Ya existe un tipo con código ${code}`);
  }
}

export async function listSigProcesses(includeInactive = false) {
  return prisma.sigProcess.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { id: true, code: true, name: true } },
      _count: { select: { documents: true, children: true } },
    },
  });
}

export async function createSigProcess(data: {
  code: string;
  name: string;
  description?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}) {
  const code = normalizeSigCatalogCode(data.code);
  await assertUniqueProcessCode(code);

  return prisma.sigProcess.create({
    data: {
      code,
      name: data.name.trim().slice(0, 200),
      description: data.description?.trim().slice(0, 4000) ?? null,
      parentId: data.parentId || null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateSigProcess(
  id: string,
  data: Partial<{
    code: string;
    name: string;
    description: string | null;
    parentId: string | null;
    sortOrder: number;
    isActive: boolean;
  }>
) {
  const patch: Prisma.SigProcessUpdateInput = {};
  if (data.code !== undefined) {
    const code = normalizeSigCatalogCode(data.code);
    await assertUniqueProcessCode(code, id);
    patch.code = code;
  }
  if (data.name !== undefined) patch.name = data.name.trim().slice(0, 200);
  if (data.description !== undefined) patch.description = data.description?.trim().slice(0, 4000) ?? null;
  if (data.parentId !== undefined) patch.parent = data.parentId ? { connect: { id: data.parentId } } : { disconnect: true };
  if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) patch.isActive = data.isActive;

  return prisma.sigProcess.update({ where: { id }, data: patch });
}

export async function deleteSigProcess(id: string) {
  const row = await prisma.sigProcess.findUnique({
    where: { id },
    include: { _count: { select: { children: true } } },
  });
  if (!row) throw new Error("Proceso no encontrado");
  if (row._count.children > 0) {
    throw new Error("No se puede eliminar: tiene subprocesos vinculados");
  }

  await prisma.sigProcess.delete({ where: { id } });
}

export async function listSigDocumentTypes(includeInactive = false) {
  return prisma.sigDocumentType.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { documents: true } } },
  });
}

export async function createSigDocumentType(data: {
  code: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}) {
  const code = normalizeSigCatalogCode(data.code);
  await assertUniqueDocumentTypeCode(code);

  return prisma.sigDocumentType.create({
    data: {
      code,
      name: data.name.trim().slice(0, 200),
      description: data.description?.trim().slice(0, 4000) ?? null,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateSigDocumentType(
  id: string,
  data: Partial<{
    code: string;
    name: string;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }>
) {
  const patch: Prisma.SigDocumentTypeUpdateInput = {};
  if (data.code !== undefined) {
    const code = normalizeSigCatalogCode(data.code);
    await assertUniqueDocumentTypeCode(code, id);
    patch.code = code;
  }
  if (data.name !== undefined) patch.name = data.name.trim().slice(0, 200);
  if (data.description !== undefined) patch.description = data.description?.trim().slice(0, 4000) ?? null;
  if (data.sortOrder !== undefined) patch.sortOrder = data.sortOrder;
  if (data.isActive !== undefined) patch.isActive = data.isActive;

  return prisma.sigDocumentType.update({ where: { id }, data: patch });
}

export async function deleteSigDocumentType(id: string) {
  const row = await prisma.sigDocumentType.findUnique({
    where: { id },
    include: { _count: { select: { documents: true } } },
  });
  if (!row) throw new Error("Tipo documental no encontrado");
  if (row._count.documents > 0) {
    throw new Error(
      `No se puede eliminar: ${row._count.documents} documento(s) usan este tipo`
    );
  }

  await prisma.sigDocumentType.delete({ where: { id } });
}
