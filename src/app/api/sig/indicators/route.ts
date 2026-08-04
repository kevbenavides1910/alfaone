import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createSigIndicator, listSigIndicators } from "@/modules/sig";
import { createIndicatorSchema } from "@/modules/sig/validations/indicators.schema";
import type { SigIndicatorStatus } from "@prisma/client";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.indicadores", "view"], errorLabel: "Error listando indicadores SIG" },
  async ({ req }) => {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const processId = req.nextUrl.searchParams.get("processId") || undefined;
    const status =
      (req.nextUrl.searchParams.get("status") as SigIndicatorStatus | null) || undefined;
    return ok(await listSigIndicators({ q, processId, status }));
  }
);

export const POST = apiHandler(
  { permission: ["sig.indicadores", "edit"], errorLabel: "Error creando indicador SIG" },
  async ({ req, session }) => {
    const parsed = createIndicatorSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de indicador inválidos", parsed.error.flatten());
    try {
      return created(
        await createSigIndicator({ ...parsed.data, createdById: sessionUserId(session) })
      );
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
