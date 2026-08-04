import { apiHandler } from "@/lib/api/handler";
import { badRequest, ok } from "@/lib/api/response";
import { deleteSigIndicatorMeasurement } from "@/modules/sig";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

export const DELETE = apiHandler(
  { permission: ["sig.indicadores", "edit"], errorLabel: "Error eliminando medición SIG" },
  async ({ params }) => {
    try {
      return ok(await deleteSigIndicatorMeasurement(paramId(await params)));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
