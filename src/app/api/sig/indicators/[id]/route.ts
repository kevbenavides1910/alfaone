import { apiHandler } from "@/lib/api/handler";
import { badRequest, created, notFound, ok } from "@/lib/api/response";
import {
  createSigIndicatorMeasurement,
  getSigIndicatorDetail,
  updateSigIndicator,
} from "@/modules/sig";
import {
  createMeasurementSchema,
  updateIndicatorSchema,
} from "@/modules/sig/validations/indicators.schema";

function paramId(params: Record<string, string | string[]>) {
  const id = params.id;
  return Array.isArray(id) ? id[0] : id;
}

function sessionUserId(session: { user?: { id?: string | null } }) {
  const id = session.user?.id;
  if (!id) throw new Error("Sesión sin usuario");
  return id;
}

export const GET = apiHandler(
  { permission: ["sig.indicadores", "view"], errorLabel: "Error consultando indicador SIG" },
  async ({ params }) => {
    const row = await getSigIndicatorDetail(paramId(await params));
    if (!row) return notFound("Indicador no encontrado");
    return ok(row);
  }
);

export const PATCH = apiHandler(
  { permission: ["sig.indicadores", "edit"], errorLabel: "Error actualizando indicador SIG" },
  async ({ req, params }) => {
    const parsed = updateIndicatorSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de indicador inválidos", parsed.error.flatten());
    try {
      return ok(await updateSigIndicator(paramId(await params), parsed.data));
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);

export const POST = apiHandler(
  { permission: ["sig.indicadores", "edit"], errorLabel: "Error registrando medición SIG" },
  async ({ req, params, session }) => {
    const parsed = createMeasurementSchema.safeParse(await req.json());
    if (!parsed.success) return badRequest("Datos de medición inválidos", parsed.error.flatten());
    try {
      return created(
        await createSigIndicatorMeasurement(paramId(await params), {
          ...parsed.data,
          recordedById: sessionUserId(session),
        })
      );
    } catch (error) {
      if (error instanceof Error) return badRequest(error.message);
      throw error;
    }
  }
);
