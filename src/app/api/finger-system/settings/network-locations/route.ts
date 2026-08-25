import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { listFingerNetworkLocations } from "@/modules/finger-system/services/finger-network-locations";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.configuracion", "admin")) return forbidden();

  try {
    return ok(await listFingerNetworkLocations());
  } catch (e) {
    return serverError("No fue posible listar unidades de red.", e);
  }
}
