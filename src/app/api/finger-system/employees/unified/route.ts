import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError, created } from "@/lib/api/response";
import {
  createOdooBiometricUser,
  listUnifiedEmployeesPreferOdoo,
  updateOdooBiometricUser,
} from "@/modules/finger-system/services/odoo-biometric-users";
import { isOdooBiometricConfigured } from "@/modules/finger-system/integrations/odoo-biometric/odoo-pg";
import { insertAtt2016UserInfo, updateAtt2016UserInfo } from "@/modules/finger-system/services/att2016-employees-write";

export const GET = withPermission(
  async (req: NextRequest) => {
    try {
      const sp = req.nextUrl.searchParams;
      const deptIdRaw = sp.get("deptId");
      const page = Number.parseInt(sp.get("page") ?? "1", 10);
      const pageSize = Number.parseInt(sp.get("pageSize") ?? "100", 10);

      return ok(
        await listUnifiedEmployeesPreferOdoo({
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
      if (!body.name?.trim()) {
        return badRequest("Nombre es obligatorio.");
      }
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null;

      if (isOdooBiometricConfigured()) {
        const result = await createOdooBiometricUser({
          badgeNumber: body.badgeNumber != null ? String(body.badgeNumber).trim() : undefined,
          name: String(body.name).trim(),
          identificationId: body.cedula != null ? String(body.cedula).trim() : null,
          privilege: body.privilege === "14" || body.privilege === "Administrador" ? "14" : "0",
          pin: body.pin != null ? String(body.pin) : null,
          card: body.card != null ? String(body.card) : null,
          pushToDevices: body.pushToDevices !== false,
          userId: session!.user!.id,
          ipAddress: ip,
        });
        return created(result);
      }

      if (!body.badgeNumber?.trim()) {
        return badRequest("AC-No./badge y nombre son obligatorios.");
      }

      const result = await insertAtt2016UserInfo({
        badgeNumber: String(body.badgeNumber).trim(),
        name: String(body.name).trim(),
        defaultDeptId:
          typeof body.deptId === "number" ? body.deptId : Number.parseInt(body.deptId ?? "1", 10) || 1,
        userId: session!.user!.id,
        ipAddress: ip,
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
      const ip =
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null;

      if (isOdooBiometricConfigured()) {
        const badge =
          body.badgeNumber != null
            ? String(body.badgeNumber).trim()
            : body.attUserId != null
              ? String(body.attUserId).trim()
              : "";
        if (!badge) return badRequest("Badge/código obligatorio.");
        const result = await updateOdooBiometricUser({
          badgeNumber: badge,
          name: body.name != null ? String(body.name).trim() : undefined,
          identificationId: body.cedula != null ? String(body.cedula).trim() : undefined,
          attEnabled: typeof body.attEnabled === "boolean" ? body.attEnabled : undefined,
          pushToDevices: body.pushToDevices === true,
          userId: session!.user!.id,
          ipAddress: ip,
        });
        return ok(result);
      }

      const attUserId = Number.parseInt(String(body.attUserId ?? ""), 10);
      if (!Number.isFinite(attUserId)) return badRequest("attUserId inválido.");

      await updateAtt2016UserInfo({
        attUserId,
        badgeNumber: body.badgeNumber != null ? String(body.badgeNumber).trim() : undefined,
        name: body.name != null ? String(body.name).trim() : undefined,
        attEnabled: typeof body.attEnabled === "boolean" ? body.attEnabled : undefined,
        userId: session!.user!.id,
        ipAddress: ip,
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
