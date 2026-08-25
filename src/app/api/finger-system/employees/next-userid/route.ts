import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { previewNextAttUserId } from "@/modules/finger-system/services/finger-employees-link";

export const GET = withPermission(
  async () => {
    try {
      return ok(await previewNextAttUserId());
    } catch (e) {
      return serverError("No fue posible calcular el siguiente USERID.", e);
    }
  },
  "fingerSystem.empleados",
  "view",
);
