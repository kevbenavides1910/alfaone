import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, notFound, serverError, noContent } from "@/lib/api/response";
import {
  deleteFingerDevice,
  getFingerDevice,
  probeFingerDevice,
  updateFingerDevice,
} from "@/modules/finger-system/services/finger-devices";
import {
  pullFingerDeviceAttendance,
  pullFingerDeviceUsers,
} from "@/modules/finger-system/services/finger-device-pull";

export const GET = withPermission(
  async (_req: NextRequest, { params }) => {
    try {
      const row = await getFingerDevice(params.id);
      if (!row) return notFound("Dispositivo no encontrado.");
      return ok(row);
    } catch (e) {
      return serverError("Error al consultar dispositivo.", e);
    }
  },
  "fingerSystem.dispositivos",
  "view",
);

export const PATCH = withPermission(
  async (req: NextRequest, { params }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const row = await updateFingerDevice(params.id, body);
      return ok(row);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible actualizar el dispositivo.", e);
    }
  },
  "fingerSystem.dispositivos",
  "edit",
);

export const DELETE = withPermission(
  async (_req: NextRequest, { params }) => {
    try {
      await deleteFingerDevice(params.id);
      return noContent();
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible eliminar el dispositivo.", e);
    }
  },
  "fingerSystem.dispositivos",
  "edit",
);

export const POST = withPermission(
  async (req: NextRequest, { session, params }) => {
    try {
      const body = await req.json().catch(() => ({}));
      if (body.action === "probe") {
        const result = await probeFingerDevice(params.id);
        return ok(result);
      }
      if (body.action === "pull-users") {
        const result = await pullFingerDeviceUsers({
          deviceId: params.id,
          userId: session!.user!.id,
          ipAddress:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            null,
        });
        return ok(result);
      }
      if (body.action === "pull-attendance") {
        const to = new Date();
        const from = new Date();
        from.setDate(from.getDate() - 7);
        const result = await pullFingerDeviceAttendance({
          deviceId: params.id,
          userId: session!.user!.id,
          from,
          to,
          ipAddress:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            null,
        });
        return ok(result);
      }
      return badRequest("Acción no reconocida.");
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible verificar el dispositivo.", e);
    }
  },
  "fingerSystem.dispositivos",
  "edit",
);
