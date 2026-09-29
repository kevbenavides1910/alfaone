import { badRequest, forbidden, notFound, serverError } from "@/lib/api/response";
import { CalendarioError } from "@/modules/naf-operaciones/services/calendario-eventos";

export function calendarioErrorResponse(e: unknown, fallback: string) {
  if (e instanceof CalendarioError) {
    if (e.status === 404) return notFound(e.message);
    if (e.status === 403) return forbidden(e.message);
    return badRequest(e.message);
  }
  return serverError(fallback, e);
}
