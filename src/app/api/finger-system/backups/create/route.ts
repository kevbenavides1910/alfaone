import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { created, badRequest, serverError } from "@/lib/api/response";
import { createFingerAtt2016Backup } from "@/modules/finger-system/services/finger-backups";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const entry = await createFingerAtt2016Backup({
        userId: session!.user!.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });
      return created(entry);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible crear el respaldo.", e);
    }
  },
  "fingerSystem.backups",
  "admin",
);
