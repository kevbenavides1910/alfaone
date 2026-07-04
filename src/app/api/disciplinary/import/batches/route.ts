import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import { prisma } from "@/modules/core/db/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "disciplinario.import", "view")) return forbidden();

  const batches = await prisma.disciplinaryImportBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      uploadedBy: { select: { name: true, email: true } },
      _count: { select: { apercibimientos: true } },
    },
  });
  return ok(batches);
}
