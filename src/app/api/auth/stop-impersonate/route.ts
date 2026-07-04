import { getSession } from "@/lib/api/middleware";
import { badRequest, forbidden, ok, serverError, unauthorized } from "@/lib/api/response";
import { buildSessionUserPayload } from "@/lib/auth/build-session-user";
import { setUserSessionCookie } from "@/lib/auth/session-cookie";

export async function POST() {
  const session = await getSession();
  if (!session) return unauthorized();

  const impersonatorId = session.user.impersonatorId;
  if (!impersonatorId) {
    return badRequest("No hay una sesión suplantada activa");
  }

  try {
    const adminUser = await buildSessionUserPayload(impersonatorId);
    if (!adminUser) {
      return forbidden("No se pudo restaurar la sesión del administrador");
    }

    await setUserSessionCookie(adminUser);
    return ok({ redirectTo: "/admin/users" });
  } catch (e) {
    return serverError("Error al salir de la suplantación", e);
  }
}
