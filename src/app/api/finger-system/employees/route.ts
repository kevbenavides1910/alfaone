import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError, created } from "@/lib/api/response";
import { listFingerEmployeeLinks } from "@/modules/finger-system/services/finger-employees-list";
import { createFingerEmployeeLink } from "@/modules/finger-system/services/finger-employees-link";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const page = Number.parseInt(sp.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(sp.get("pageSize") ?? "25", 10);
      const hasAttRaw = sp.get("hasAttUserId");

      const result = await listFingerEmployeeLinks({
        q: sp.get("q") ?? undefined,
        company: sp.get("company") ?? undefined,
        hasAttUserId: hasAttRaw === "true" ? true : hasAttRaw === "false" ? false : undefined,
        page: Number.isNaN(page) ? 1 : page,
        pageSize: Number.isNaN(pageSize) ? 25 : pageSize,
      });

      return ok(result);
    } catch (e) {
      return serverError("Error al listar empleados biométricos.", e);
    }
  },
  "fingerSystem.empleados",
  "view",
);

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      if (!body.employeeId && !body.employeeCodigo) {
        return badRequest("Indique employeeId o employeeCodigo.");
      }

      const row = await createFingerEmployeeLink({
        employeeId: body.employeeId,
        employeeCodigo: body.employeeCodigo,
        badgeNumber: body.badgeNumber,
        pushToAtt: body.pushToAtt === true,
        userId: session!.user!.id,
        headers: req.headers,
      });

      return created(row);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible crear el vínculo biométrico.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);
