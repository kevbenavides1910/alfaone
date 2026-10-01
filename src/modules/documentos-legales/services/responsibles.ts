import { prisma } from "@/modules/core/db/prisma";
import type { ResponsibleUserDto } from "../business/dto";
import { LegalDocumentError } from "./errors";

const PERMISSION_KEY = "documentosLegales.calendario";

/** Usuarios activos que pueden ser responsables: admin o permiso edit/admin del módulo. */
export async function listResponsibleUsers(): Promise<ResponsibleUserDto[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roleEntity: {
        select: {
          code: true,
          permissions: {
            where: { permissionKey: PERMISSION_KEY },
            select: { level: true },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return users
    .filter((user) => {
      const code = user.roleEntity?.code;
      if (code === "ADMIN") return true;
      if (!code && user.role === "ADMIN") return true;
      const level = user.roleEntity?.permissions[0]?.level;
      return level === "EDIT" || level === "ADMIN";
    })
    .map((user) => ({ id: user.id, name: user.name, email: user.email }));
}

export async function assertResponsibleUser(userId: string): Promise<ResponsibleUserDto> {
  const allowed = await listResponsibleUsers();
  const found = allowed.find((user) => user.id === userId);
  if (!found) {
    throw new LegalDocumentError(
      "El responsable debe ser un usuario activo con permiso de edición",
      "BAD_REQUEST",
    );
  }
  return found;
}
