import { Prisma } from "@prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { badRequest, conflict, created, ok } from "@/lib/api/response";
import { createSigRequirement, listSigRequirements, listSigStandards } from "@/modules/sig";
import { createRequirementSchema } from "@/modules/sig/validations/requirements.schema";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.requisitos", "view"], errorLabel: "Error listando requisitos SIG" },
  async ({ req }) => {
    const standards = req.nextUrl.searchParams.get("standards") === "1";
    if (standards) return ok(await listSigStandards());

    const standardId = req.nextUrl.searchParams.get("standardId") || undefined;
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const applicableOnly = req.nextUrl.searchParams.get("applicable") === "1";
    return ok(await listSigRequirements({ standardId, q, applicableOnly }));
  }
);

export const POST = apiHandler(
  { permission: ["sig.requisitos", "edit"], errorLabel: "Error creando requisito SIG" },
  async ({ req, session }) => {
    const parsed = createRequirementSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de requisito inválidos", parsed.error.flatten());
    try {
      return created(
        await createSigRequirement({ ...parsed.data, createdById: sessionUserId(session) })
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return conflict("Ya existe un requisito con ese código en la norma");
      }
      throw error;
    }
  }
);
