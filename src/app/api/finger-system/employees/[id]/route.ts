import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, badRequest, notFound, serverError, noContent } from "@/lib/api/response";
import { getFingerEmployeeLink } from "@/modules/finger-system/services/finger-employees-list";
import {
  deleteFingerEmployeeLink,
  pushFingerEmployeeLinkToAtt,
  updateFingerEmployeeLink,
} from "@/modules/finger-system/services/finger-employees-link";

export const GET = withPermission(
  async (_req: NextRequest, { params }) => {
    try {
      const row = await getFingerEmployeeLink(params.id);
      if (!row) return notFound("Vínculo biométrico no encontrado.");
      return ok(row);
    } catch (e) {
      return serverError("Error al consultar vínculo biométrico.", e);
    }
  },
  "fingerSystem.empleados",
  "view",
);

export const PATCH = withPermission(
  async (req: NextRequest, { session, params }) => {
    try {
      const body = await req.json().catch(() => ({}));
      const row = await updateFingerEmployeeLink(params.id, {
        badgeNumber: body.badgeNumber,
        pushToAtt: body.pushToAtt === true,
        userId: session!.user!.id,
        headers: req.headers,
      });
      return ok(row);
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible actualizar el vínculo biométrico.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);

export const DELETE = withPermission(
  async (req: NextRequest, { session, params }) => {
    try {
      await deleteFingerEmployeeLink(params.id, {
        userId: session!.user!.id,
        headers: req.headers,
      });
      return noContent();
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible eliminar el vínculo biométrico.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);

export const POST = withPermission(
  async (req: NextRequest, { session, params }) => {
    try {
      const body = await req.json().catch(() => ({}));
      if (body.action === "push-att") {
        const row = await pushFingerEmployeeLinkToAtt(params.id, {
          userId: session!.user!.id,
          headers: req.headers,
        });
        return ok(row);
      }
      return badRequest("Acción no reconocida.");
    } catch (e) {
      if (e instanceof Error) return badRequest(e.message);
      return serverError("No fue posible sincronizar con ATT2016.", e);
    }
  },
  "fingerSystem.empleados",
  "edit",
);
