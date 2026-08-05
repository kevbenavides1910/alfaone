import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, ok } from "@/lib/api/response";
import { createSigManagementReview, listSigManagementReviews } from "@/modules/sig";
import { createManagementReviewSchema } from "@/modules/sig/validations/management-reviews.schema";
import type { SigManagementReviewStatus } from "@prisma/client";

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.revisionDireccion", "view"], errorLabel: "Error listando revisiones por la dirección" },
  async ({ req }) => {
    const q = req.nextUrl.searchParams.get("q") || undefined;
    const status =
      (req.nextUrl.searchParams.get("status") as SigManagementReviewStatus | null) || undefined;
    const yearRaw = req.nextUrl.searchParams.get("year");
    const year = yearRaw ? Number(yearRaw) : undefined;
    return ok(
      await listSigManagementReviews({
        q,
        status,
        year: year && Number.isFinite(year) ? year : undefined,
      })
    );
  }
);

export const POST = apiHandler(
  { permission: ["sig.revisionDireccion", "edit"], errorLabel: "Error creando revisión por la dirección" },
  async ({ req, session }) => {
    const parsed = createManagementReviewSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de revisión inválidos", parsed.error.flatten());
    try {
      return created(
        await createSigManagementReview({
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
