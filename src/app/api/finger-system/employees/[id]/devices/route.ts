import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, serverError } from "@/lib/api/response";
import {
  listEmployeeDeviceAssignments,
  setEmployeeDeviceAssignments,
} from "@/modules/finger-system/services/finger-device-push";

export const GET = withPermission(
  async (_req: NextRequest, { params }) => {
    try {
      return ok(await listEmployeeDeviceAssignments(params.id));
    } catch (e) {
      return serverError("Error al listar relojes asignados.", e);
    }
  },
  "fingerSystem.empleados",
  "view",
);

export const PUT = withPermission(
  async (req: NextRequest, { params }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const deviceIds = Array.isArray(body.deviceIds)
        ? body.deviceIds.map(String).filter(Boolean)
        : [];
      return ok(await setEmployeeDeviceAssignments({ employeeId: params.id, deviceIds }));
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible guardar asignaciones.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);
