import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listFingerBiometrics } from "@/modules/finger-system/services/att2016-templates-sync";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const page = Number.parseInt(sp.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);
      const hasFp = sp.get("hasFingerprints");

      const result = await listFingerBiometrics({
        q: sp.get("q") ?? undefined,
        hasFingerprints: hasFp === "true" ? true : hasFp === "false" ? false : undefined,
        page: Number.isNaN(page) ? 1 : page,
        pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
      });

      return ok(result);
    } catch (e) {
      return serverError("Error al listar biometría.", e);
    }
  },
  "fingerSystem.biometria",
  "view",
);
