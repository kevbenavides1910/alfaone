import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listFingerCompanySummaries } from "@/modules/finger-system/services/finger-companies";

export const GET = withPermission(
  async () => {
    try {
      return ok(await listFingerCompanySummaries());
    } catch (e) {
      return serverError("Error al listar empresas Finger System.", e);
    }
  },
  "fingerSystem.empresas",
  "view",
);
