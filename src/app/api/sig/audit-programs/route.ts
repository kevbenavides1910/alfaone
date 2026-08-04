import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import {
  computeProcedurePriorities,
  createAuditProgram,
  getAuditProgramByYear,
  listAuditPrograms,
} from "@/modules/sig";
import { createAuditProgramSchema } from "@/modules/sig/validations/audit-program.schema";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.auditorias", "view"], errorLabel: "Error listando programas de auditoría" },
  async ({ req }) => {
    const yearParam = req.nextUrl.searchParams.get("year");
    if (yearParam) {
      const year = Number(yearParam);
      if (!Number.isInteger(year)) return badRequest("Año inválido");
      const program = await getAuditProgramByYear(year);
      if (req.nextUrl.searchParams.get("suggestions") === "1") {
        return ok({
          program,
          suggestions: await computeProcedurePriorities(year),
        });
      }
      return ok(program);
    }
    return ok(await listAuditPrograms());
  }
);

export const POST = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error creando programa de auditoría" },
  async ({ req, session }) => {
    const parsed = createAuditProgramSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de programa inválidos", parsed.error.flatten());
    try {
      return created(
        await createAuditProgram({
          ...parsed.data,
          createdById: sessionUserId(session),
        })
      );
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
