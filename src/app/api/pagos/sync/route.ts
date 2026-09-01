import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { syncPaymentsForYear } from "@/modules/pagos/services/pagos";

/**
 * POST /api/pagos/sync?year=2026[&fromMonth=1&toMonth=8]
 * Materializa gastos aprobados + pagos fijos APEX de los meses indicados.
 * Por defecto: enero → mes anterior al actual del año pedido.
 */
export const POST = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const yearRaw = sp.get("year");
      const fromRaw = sp.get("fromMonth");
      const toRaw = sp.get("toMonth");

      const year = yearRaw ? Number.parseInt(yearRaw, 10) : new Date().getFullYear();
      if (!Number.isInteger(year) || year < 2000 || year > 2100) {
        return badRequest("year inválido");
      }

      const fromMonth = fromRaw ? Number.parseInt(fromRaw, 10) : undefined;
      const toMonth = toRaw ? Number.parseInt(toRaw, 10) : undefined;
      if (fromMonth != null && (!Number.isInteger(fromMonth) || fromMonth < 1 || fromMonth > 12)) {
        return badRequest("fromMonth inválido (1-12)");
      }
      if (toMonth != null && (!Number.isInteger(toMonth) || toMonth < 1 || toMonth > 12)) {
        return badRequest("toMonth inválido (1-12)");
      }

      const result = await syncPaymentsForYear({ year, fromMonth, toMonth });
      return ok(result);
    } catch (e) {
      return serverError("Error al sincronizar pagos del año", e);
    }
  },
  "pagos.calendario",
  "edit",
);
