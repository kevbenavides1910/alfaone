import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { previewAtt2016TemplateSync } from "@/modules/finger-system/services/att2016-templates-sync";

export const GET = withPermission(
  async () => {
    try {
      return ok(await previewAtt2016TemplateSync());
    } catch (e) {
      return serverError("No fue posible analizar huellas en ATT2016.", e);
    }
  },
  "fingerSystem.biometria",
  "view",
);
