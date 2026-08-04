import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createSigIncident, listSigIncidents } from "@/modules/sig";
import { createIncidentSchema } from "@/modules/sig/validations/incidents.schema";
import type { SigIncidentStatus, SigIncidentType } from "@prisma/client";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.incidentes", "view"], errorLabel: "Error listando incidentes SIG" },
  async ({ req }) => {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const processId = req.nextUrl.searchParams.get("processId") || undefined;
    const type = (req.nextUrl.searchParams.get("type") as SigIncidentType | null) || undefined;
    const status =
      (req.nextUrl.searchParams.get("status") as SigIncidentStatus | null) || undefined;
    const hr = req.nextUrl.searchParams.get("humanRightsImpact");
    const humanRightsImpact = hr === "1" ? true : hr === "0" ? false : undefined;
    return ok(await listSigIncidents({ q, processId, type, status, humanRightsImpact }));
  }
);

export const POST = apiHandler(
  { permission: ["sig.incidentes", "edit"], errorLabel: "Error creando incidente SIG" },
  async ({ req, session }) => {
    const parsed = createIncidentSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de incidente inválidos", parsed.error.flatten());
    try {
      return created(
        await createSigIncident({ ...parsed.data, createdById: sessionUserId(session) })
      );
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
