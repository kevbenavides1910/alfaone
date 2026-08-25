import { withPermission } from "@/lib/permissions/middleware";
import { ok } from "@/lib/api/response";
import { getFingerSettingsPublic } from "@/modules/finger-system/services/finger-settings";

/** Modo operativo del módulo (sin exponer rutas SMB). */
export const GET = withPermission(
  async () => {
    const settings = await getFingerSettingsPublic();
    return ok({
      linkRrhhEmployees: settings.linkRrhhEmployees,
    });
  },
  "fingerSystem.empleados",
  "view",
);
