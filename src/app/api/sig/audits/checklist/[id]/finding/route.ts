import { apiHandler } from "@/lib/api/handler";
import { badRequest, created } from "@/lib/api/response";
import { createFindingFromChecklist } from "@/modules/sig";
import { z } from "zod";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

const bodySchema = z.object({
  title: z.string().trim().max(200).optional(),
  findingType: z.enum(["NONCONFORMITY", "OBSERVATION", "OPPORTUNITY"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});

export const POST = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error generando hallazgo desde checklist" },
  async ({ req, params, session }) => {
    const json = await req.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    try {
      return created(
        await createFindingFromChecklist({
          checklistItemId: paramId(await params),
          createdById: sessionUserId(session),
          ...parsed.data,
        })
      );
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
