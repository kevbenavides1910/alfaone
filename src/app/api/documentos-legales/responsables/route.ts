import { NextRequest } from "next/server";
import { withPermission } from "@/lib/permissions/middleware";
import { ok, serverError } from "@/lib/api/response";
import { listResponsibleUsers } from "@/modules/documentos-legales/services/responsibles";

/** Usuarios activos con permiso de edición, para el selector de responsable. */
export const GET = withPermission(async () => {
  try {
    return ok(await listResponsibleUsers());
  } catch (error) {
    return serverError("Error al listar responsables", error);
  }
}, "documentosLegales.calendario", "edit");
