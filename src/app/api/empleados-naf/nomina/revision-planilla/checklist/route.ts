import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import {
  upsertRevisionChecklistFlag,
  type RevisionChecklistField,
} from "@/modules/empleados-naf/services/revision-planilla-checklist";

const FIELDS = new Set(["revisada", "generada", "pagada", "pagadaCk", "pagadaDav", "pagadaBn"]);

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleadosNaf.revisionPlanilla", "edit")) return forbidden();

  try {
    const body = (await req.json()) as {
      noCia?: string;
      codPla?: string;
      fDesde?: string;
      fHasta?: string;
      field?: string;
      value?: boolean;
    };

    const noCia = body.noCia?.trim();
    const codPla = body.codPla?.trim();
    const fDesde = body.fDesde?.trim();
    const fHasta = body.fHasta?.trim();
    const field = body.field?.trim();
    const value = body.value;

    if (!noCia || !codPla || !fDesde || !fHasta || !field || typeof value !== "boolean") {
      return badRequest("Parámetros requeridos: noCia, codPla, fDesde, fHasta, field, value");
    }
    if (!FIELDS.has(field)) {
      return badRequest("field debe ser revisada, generada, pagadaCk, pagadaDav o pagadaBn");
    }

    const checklist = await upsertRevisionChecklistFlag({
      noCia,
      codPla,
      fDesde,
      fHasta,
      field: field as RevisionChecklistField,
      value,
      updatedBy: session.user?.email ?? session.user?.name ?? session.user?.id ?? null,
    });

    return ok({ checklist });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error al actualizar checklist";
    if (message.includes("requeridos") || message.includes("inválid") || message.includes("Campo inválido")) {
      return badRequest(message);
    }
    return serverError("Error al actualizar checklist de revisión de planilla", e);
  }
}
