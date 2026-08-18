import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { previewAtt2016MachineImport } from "@/modules/finger-system/services/att2016-machines-import";

export const GET = withPermission(
  async () => {
    try {
      return ok(await previewAtt2016MachineImport());
    } catch (e) {
      return serverError("No fue posible analizar dispositivos en ATT2016.", e);
    }
  },
  "fingerSystem.dispositivos",
  "view",
);
