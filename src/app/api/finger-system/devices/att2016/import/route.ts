import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { applyAtt2016MachineImport } from "@/modules/finger-system/services/att2016-machines-import";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const result = await applyAtt2016MachineImport({
        userId: session!.user!.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });
      return ok(result);
    } catch (e) {
      return serverError("No fue posible importar dispositivos desde ATT2016.", e);
    }
  },
  "fingerSystem.dispositivos",
  "edit",
);
