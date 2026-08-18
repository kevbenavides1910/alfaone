import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listFingerSyncLogs } from "@/modules/finger-system/services/finger-audit-list";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const page = Number.parseInt(sp.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);

      const result = await listFingerSyncLogs({
        operation: sp.get("operation") ?? undefined,
        status: sp.get("status") ?? undefined,
        page: Number.isNaN(page) ? 1 : page,
        pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
      });

      return ok(result);
    } catch (e) {
      return serverError("Error al listar sincronizaciones.", e);
    }
  },
  "fingerSystem.auditoria",
  "view",
);
