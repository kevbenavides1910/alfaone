import { Prisma } from "@prisma/client";
import { apiHandler } from "@/lib/api/handler";
import { badRequest, conflict, created, ok } from "@/lib/api/response";
import { createAudit, listAuditQuarterDashboard } from "@/modules/sig";
import { createAuditSchema } from "@/modules/sig/validations/audits.schema";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.auditorias", "view"], errorLabel: "Error listando auditorías SIG" },
  async ({ req }) => {
    const yearParam = req.nextUrl.searchParams.get("year");
    const quarterParam = req.nextUrl.searchParams.get("quarter");
    const year = yearParam ? Number(yearParam) : undefined;
    const quarter = quarterParam ? Number(quarterParam) : undefined;
    if ((yearParam && !Number.isInteger(year)) || (quarterParam && !Number.isInteger(quarter))) {
      return badRequest("Parámetros de trimestre inválidos");
    }
    return ok(await listAuditQuarterDashboard({ year, quarter }));
  }
);

export const POST = apiHandler(
  { permission: ["sig.auditorias", "edit"], errorLabel: "Error creando auditoría SIG" },
  async ({ req, session }) => {
    const parsed = createAuditSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de auditoría inválidos", parsed.error.flatten());

    try {
      return created(await createAudit({ ...parsed.data, createdById: sessionUserId(session) }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        return conflict("Este procedimiento ya tiene auditoría asignada para el trimestre");
      }
      throw error;
    }
  }
);
