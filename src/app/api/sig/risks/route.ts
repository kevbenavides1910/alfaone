import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createSigRisk, listSigRisks } from "@/modules/sig";
import { createRiskSchema } from "@/modules/sig/validations/risks.schema";
import type { SigRiskKind, SigRiskStatus } from "@prisma/client";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.riesgos", "view"], errorLabel: "Error listando riesgos SIG" },
  async ({ req }) => {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const processId = req.nextUrl.searchParams.get("processId") || undefined;
    const kind = (req.nextUrl.searchParams.get("kind") as SigRiskKind | null) || undefined;
    const status = (req.nextUrl.searchParams.get("status") as SigRiskStatus | null) || undefined;
    const minScoreParam = req.nextUrl.searchParams.get("minScore");
    const minScore = minScoreParam ? Number(minScoreParam) : undefined;
    return ok(await listSigRisks({ q, processId, kind, status, minScore }));
  }
);

export const POST = apiHandler(
  { permission: ["sig.riesgos", "edit"], errorLabel: "Error creando riesgo SIG" },
  async ({ req, session }) => {
    const parsed = createRiskSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de riesgo inválidos", parsed.error.flatten());
    try {
      return created(await createSigRisk({ ...parsed.data, createdById: sessionUserId(session) }));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
