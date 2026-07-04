import { NextRequest } from "next/server";
import { badRequest, serverError } from "@/lib/api/response";
import { verifyImpersonationToken } from "@/lib/auth/impersonation-token";
import { buildSessionUserPayload } from "@/lib/auth/build-session-user";
import { setUserSessionCookie } from "@/lib/auth/session-cookie";
import { prisma } from "@/modules/core/db/prisma";

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get("token")?.trim();
    if (!token) {
      return badRequest("Token requerido");
    }

    const payload = verifyImpersonationToken(token);
    if (!payload) {
      return badRequest("Token inválido o expirado");
    }

    const admin = await prisma.user.findUnique({
      where: { id: payload.adminId },
      select: { id: true, name: true, isActive: true },
    });
    if (!admin || !admin.isActive) {
      return badRequest("El administrador que inició la suplantación ya no está activo");
    }

    const sessionUser = await buildSessionUserPayload(payload.targetUserId, {
      impersonatorId: admin.id,
      impersonatorName: admin.name,
    });
    if (!sessionUser) {
      return badRequest("El usuario destino no existe o está inactivo");
    }

    await setUserSessionCookie(sessionUser);

    return Response.json({ data: { ok: true, redirectTo: "/home" } });
  } catch (e) {
    return serverError("Error al ingresar como otro usuario", e);
  }
}
