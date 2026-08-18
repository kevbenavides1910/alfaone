import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError, created } from "@/lib/api/response";
import { createFingerShift, listFingerShifts } from "@/modules/finger-system/services/finger-shifts";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      return ok(
        await listFingerShifts({
          company: sp.get("company") ?? undefined,
          activeOnly: sp.get("activeOnly") !== "false",
        }),
      );
    } catch (e) {
      return serverError("Error al listar turnos.", e);
    }
  },
  "fingerSystem.turnos",
  "view",
);

export const POST = withPermission(
  async (req: NextRequest) => {
    try {
      const body = await req.json().catch(() => ({}));
      if (!body.name?.trim() || !body.startTime?.trim() || !body.endTime?.trim()) {
        return badRequest("Nombre, hora inicio y hora fin son obligatorios.");
      }
      return created(await createFingerShift(body));
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible crear el turno.", e);
    }
  },
  "fingerSystem.turnos",
  "edit",
);
