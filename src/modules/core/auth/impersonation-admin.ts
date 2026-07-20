import { getUserPermissionContext } from "@/lib/permissions/resolve";

/** Comprueba si el usuario real (no el rol impersonado) puede usar vista previa de roles. */
export async function userIsPlatformAdmin(userId: string): Promise<boolean> {
  const ctx = await getUserPermissionContext(userId);
  if (!ctx) return false;
  if (ctx.roleCode === "ADMIN") return true;
  return (ctx.permissions["plataforma.roles"] ?? "none") === "admin";
}
