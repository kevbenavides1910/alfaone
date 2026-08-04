import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createSigLegalRequirement, listSigLegalRequirements } from "@/modules/sig";
import { createLegalRequirementSchema } from "@/modules/sig/validations/legal.schema";
import type { SigLegalComplianceStatus } from "@prisma/client";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.legales", "view"], errorLabel: "Error listando requisitos legales SIG" },
  async ({ req }) => {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const processId = req.nextUrl.searchParams.get("processId") || undefined;
    const jurisdiction = req.nextUrl.searchParams.get("jurisdiction") || undefined;
    const complianceStatus =
      (req.nextUrl.searchParams.get("complianceStatus") as SigLegalComplianceStatus | null) ||
      undefined;
    return ok(await listSigLegalRequirements({ q, processId, jurisdiction, complianceStatus }));
  }
);

export const POST = apiHandler(
  { permission: ["sig.legales", "edit"], errorLabel: "Error creando requisito legal SIG" },
  async ({ req, session }) => {
    const parsed = createLegalRequirementSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos legales inválidos", parsed.error.flatten());
    try {
      return created(
        await createSigLegalRequirement({ ...parsed.data, createdById: sessionUserId(session) })
      );
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
