import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { isPlatformAdmin } from "@/lib/permissions/check";
import { created, unauthorized, forbidden, serverError, notFound } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { getRoleById } from "@/modules/plataforma/services/roles";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!isPlatformAdmin(session)) return forbidden();

  try {
    const { id } = await params;
    const role = await getRoleById(prisma, id);
    if (!role) return notFound("Rol no encontrado");

    // The actual impersonation logic is handled client-side via session refresh
    // This endpoint validates permissions and confirms the role exists.
    // For full JWT impersonation support, extend auth-options with impersonated fields.
    return created({ success: true, roleId: id, roleCode: role.code, name: role.name });
  } catch (e) {
    return serverError(e instanceof Error ? e.message : "Error al impersonar rol", e);
  }
}
