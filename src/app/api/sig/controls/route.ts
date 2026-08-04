import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createSigControl, listSigControls } from "@/modules/sig";
import { createControlSchema } from "@/modules/sig/validations/controls.schema";
import type { SigControlStatus } from "@prisma/client";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.controles", "view"], errorLabel: "Error listando controles SIG" },
  async ({ req }) => {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const processId = req.nextUrl.searchParams.get("processId") || undefined;
    const requirementId = req.nextUrl.searchParams.get("requirementId") || undefined;
    const status = (req.nextUrl.searchParams.get("status") as SigControlStatus | null) || undefined;
    return ok(await listSigControls({ q, processId, requirementId, status }));
  }
);

export const POST = apiHandler(
  { permission: ["sig.controles", "edit"], errorLabel: "Error creando control SIG" },
  async ({ req, session }) => {
    const parsed = createControlSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de control inválidos", parsed.error.flatten());
    try {
      return created(
        await createSigControl({ ...parsed.data, createdById: sessionUserId(session) })
      );
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
