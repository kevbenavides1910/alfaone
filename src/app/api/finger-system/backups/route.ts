import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listFingerBackups } from "@/modules/finger-system/services/finger-backups";

export const GET = withPermission(
  async () => {
    try {
      return ok(await listFingerBackups());
    } catch (e) {
      return serverError("Error al listar respaldos.", e);
    }
  },
  "fingerSystem.backups",
  "view",
);
