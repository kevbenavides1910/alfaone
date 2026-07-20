import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, badRequest, serverError } from "@/lib/api/response";
import { searchEmployeesForDisciplinary } from "@/modules/disciplinario/services/disciplinary-employee-lookup";

const QuerySchema = z.object({
  q: z.string().trim().min(1, "Debe ingresar al menos un carácter"),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(req.url);
    const parsed = QuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return badRequest("Parámetros inválidos", parsed.error.flatten());
    }

    const { q, limit } = parsed.data;
    const rows = await searchEmployeesForDisciplinary(q, limit);
    return ok(rows);
  } catch (e) {
    return serverError(
      e instanceof Error ? e.message : "Error al buscar empleados",
      e,
    );
  }
}
