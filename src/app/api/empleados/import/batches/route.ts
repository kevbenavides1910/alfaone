import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "empleados.import", "view")) return forbidden();

  try {
    const batches = await prisma.employeeImportBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        filename: true,
        rowsProcessed: true,
        employeesUpserted: true,
        placementsUpserted: true,
        rowsSkipped: true,
        employeesDeactivated: true,
        errorsJson: true,
        createdAt: true,
        uploadedBy: { select: { name: true, email: true } },
      },
    });
    return ok(batches);
  } catch (e) {
    return serverError("Error al listar lotes de importación", e);
  }
}
