import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { restoreFingerAtt2016Backup } from "@/modules/finger-system/services/finger-backups";

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const folderName = String(body.folderName ?? "").trim();
      const confirmToken = String(body.confirmToken ?? "").trim();
      if (!folderName) return badRequest("folderName es requerido.");

      const result = await restoreFingerAtt2016Backup({
        folderName,
        confirmToken,
        userId: session!.user!.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });
      return ok(result);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible restaurar el respaldo.", e);
    }
  },
  "fingerSystem.backups",
  "admin",
);
