import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import { applyAtt2016PunchImport } from "@/modules/finger-system/services/att2016-punches-import";
import { z } from "zod";

const bodySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const parsed = bodySchema.safeParse(await req.json());
      if (!parsed.success) {
        return badRequest("Indique from y to con formato YYYY-MM-DD.");
      }
      const from = new Date(`${parsed.data.from}T00:00:00`);
      const to = new Date(`${parsed.data.to}T00:00:00`);
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null;

      const result = await applyAtt2016PunchImport({
        userId: session!.user!.id,
        from,
        to,
        ipAddress: ip,
      });
      return ok(result);
    } catch (e) {
      if (e instanceof Error && e.message.includes("fecha")) return badRequest(e.message);
      return serverError("No fue posible importar marcas desde ATT2016.", e);
    }
  },
  "fingerSystem.asistencia",
  "edit",
);
