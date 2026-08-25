import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError, created } from "@/lib/api/response";
import { listUnifiedEmployees } from "@/modules/finger-system/services/finger-unified-employees";
import { insertAtt2016UserInfo, updateAtt2016UserInfo } from "@/modules/finger-system/services/att2016-employees-write";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const deptIdRaw = sp.get("deptId");
      const page = Number.parseInt(sp.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(sp.get("pageSize") ?? "100", 10);

      return ok(
        await listUnifiedEmployees({
          q: sp.get("q") ?? undefined,
          company: sp.get("company") ?? undefined,
          deptId: deptIdRaw ? Number.parseInt(deptIdRaw, 10) : undefined,
          includeSubDepts: sp.get("includeSubDepts") === "true",
          page: Number.isNaN(page) ? 1 : page,
          pageSize: Number.isNaN(pageSize) ? 100 : pageSize,
        }),
      );
    } catch (e) {
      return serverError("No fue posible listar empleados.", e);
    }
  },
  "fingerSystem.empleados",
  "view",
);

export const POST = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      if (!body.badgeNumber?.trim() || !body.name?.trim()) {
        return badRequest("AC-No./badge y nombre son obligatorios.");
      }

      const result = await insertAtt2016UserInfo({
        badgeNumber: String(body.badgeNumber).trim(),
        name: String(body.name).trim(),
        defaultDeptId:
          typeof body.deptId === "number" ? body.deptId : Number.parseInt(body.deptId ?? "1", 10) || 1,
        userId: session!.user!.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });

      return created({ id: `att:${result.attUserId}`, ...result });
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible crear el empleado.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);

export const PATCH = withPermission(
  async (req: NextRequest, { session }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const attUserId = Number.parseInt(String(body.attUserId ?? ""), 10);
      if (!Number.isFinite(attUserId)) return badRequest("attUserId inválido.");

      await updateAtt2016UserInfo({
        attUserId,
        badgeNumber: body.badgeNumber != null ? String(body.badgeNumber).trim() : undefined,
        name: body.name != null ? String(body.name).trim() : undefined,
        attEnabled: typeof body.attEnabled === "boolean" ? body.attEnabled : undefined,
        userId: session!.user!.id,
        ipAddress:
          req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          req.headers.get("x-real-ip") ||
          null,
      });

      return ok({ attUserId });
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible actualizar el empleado.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);
