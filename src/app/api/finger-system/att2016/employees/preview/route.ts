import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { previewAtt2016EmployeeImport } from "@/modules/finger-system/services/att2016-employees-import";

export const GET = withPermission(
  async () => {
    try {
      return ok(await previewAtt2016EmployeeImport());
    } catch (e) {
      return serverError("No fue posible analizar empleados en ATT2016.", e);
    }
  },
  "fingerSystem.empleados",
  "view",
);
