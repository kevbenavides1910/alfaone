import type { PrismaClient, PermissionLevel } from "@prisma/client";
import { allPermissionKeys } from "@/lib/permissions/registry";
import { permissionLevelToDb, permissionLevelFromDb } from "@/lib/permissions/levels";
import type { PermissionLevelId } from "@/lib/permissions/registry";

export type RolePermissionInput = {
  permissionKey: string;
  level: PermissionLevelId;
};

export async function listRoles(prisma: PrismaClient) {
  const roles = await prisma.role.findMany({
    orderBy: [{ isSystem: "desc" }, { name: "asc" }],
    include: {
      _count: { select: { users: true } },
      permissions: { where: { level: { not: "NONE" } } },
    },
  });
  return roles.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description,
    isSystem: r.isSystem,
    userCount: r._count.users,
    permissions: r.permissions.map((p) => ({
      permissionKey: p.permissionKey,
      level: permissionLevelFromDb(p.level),
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getRoleById(prisma: PrismaClient, id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: {
      _count: { select: { users: true } },
      permissions: true,
    },
  });
  if (!role) return null;
  const map: Record<string, PermissionLevelId> = {};
  for (const key of allPermissionKeys()) {
    map[key] = "none";
  }
  for (const p of role.permissions) {
    map[p.permissionKey] = permissionLevelFromDb(p.level);
  }
  return {
    id: role.id,
    code: role.code,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    userCount: role._count.users,
    permissionMap: map,
    createdAt: role.createdAt.toISOString(),
    updatedAt: role.updatedAt.toISOString(),
  };
}

function slugCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40) || "ROL";
}

export async function createRole(
  prisma: PrismaClient,
  data: { name: string; description?: string; code?: string; permissions: RolePermissionInput[] }
) {
  const code = data.code?.trim().toUpperCase() || slugCode(data.name);
  const existing = await prisma.role.findUnique({ where: { code } });
  if (existing) throw new Error("Ya existe un rol con ese código");

  const role = await prisma.role.create({
    data: {
      code,
      name: data.name.trim(),
      description: data.description?.trim() || null,
      isSystem: false,
    },
  });
  await upsertRolePermissions(prisma, role.id, data.permissions);
  return getRoleById(prisma, role.id);
}

export async function updateRole(
  prisma: PrismaClient,
  id: string,
  data: {
    name?: string;
    description?: string | null;
    permissions?: RolePermissionInput[];
  }
) {
  const role = await prisma.role.findUnique({ where: { id } });
  if (!role) throw new Error("Rol no encontrado");

  await prisma.role.update({
    where: { id },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.description !== undefined
        ? { description: data.description?.trim() || null }
        : {}),
    },
  });
  if (data.permissions) {
    await upsertRolePermissions(prisma, id, data.permissions);
  }
  return getRoleById(prisma, id);
}

async function upsertRolePermissions(
  prisma: PrismaClient,
  roleId: string,
  permissions: RolePermissionInput[]
) {
  const validKeys = new Set(allPermissionKeys());
  for (const { permissionKey, level } of permissions) {
    if (!validKeys.has(permissionKey as never)) continue;
    const dbLevel = permissionLevelToDb(level);
    if (dbLevel === "NONE") {
      await prisma.rolePermission.deleteMany({
        where: { roleId, permissionKey },
      });
    } else {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionKey: { roleId, permissionKey } },
        create: { roleId, permissionKey, level: dbLevel },
        update: { level: dbLevel },
      });
    }
  }
}

export async function deleteRole(prisma: PrismaClient, id: string) {
  const role = await prisma.role.findUnique({
    where: { id },
    include: { _count: { select: { users: true } } },
  });
  if (!role) throw new Error("Rol no encontrado");
  if (role.isSystem) throw new Error("No se puede eliminar un rol del sistema");
  if (role._count.users > 0) {
    throw new Error("El rol tiene usuarios asignados");
  }
  await prisma.role.delete({ where: { id } });
}

export async function duplicateRole(prisma: PrismaClient, id: string, newName: string) {
  const source = await getRoleById(prisma, id);
  if (!source) throw new Error("Rol no encontrado");
  const perms = Object.entries(source.permissionMap)
    .filter(([, level]) => level !== "none")
    .map(([permissionKey, level]) => ({ permissionKey, level }));
  return createRole(prisma, {
    name: newName,
    description: source.description ?? undefined,
    permissions: perms,
  });
}
