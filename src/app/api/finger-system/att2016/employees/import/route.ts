import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { applyAtt2016EmployeeImport } from "@/modules/finger-system/services/att2016-employees-import";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const onlyMatchable = body.onlyMatchable !== false;

      const result = await applyAtt2016EmployeeImport({
        userId: session!.user!.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
        onlyMatchable,
      });
      return ok(result);
    } catch (e) {
      if (e instanceof Error && e.message.includes("fecha")) return badRequest(e.message);
      return serverError("No fue posible importar empleados desde ATT2016.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);
