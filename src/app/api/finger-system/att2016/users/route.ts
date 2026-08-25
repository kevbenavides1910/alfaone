import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { fetchAtt2016UserInfo } from "@/modules/finger-system/services/att2016-employees-import";

export const GET = withPermission(
  async () => {
    try {
      const users = await fetchAtt2016UserInfo();
      return ok({
        total: users.length,
        items: users.map((u) => ({
          attUserId: u.attUserId,
          badgeNumber: u.badgeNumber,
          name: u.name,
          attEnabled: u.attEnabled,
        })),
      });
    } catch (e) {
      return serverError("No fue posible leer USERINFO desde ATT2016.", e);
    }
  },
  "fingerSystem.empleados",
  "view",
);
