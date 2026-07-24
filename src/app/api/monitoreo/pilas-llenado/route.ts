import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, created, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import {
  buildReportePilasDia,
  listPilasLlenado,
  parseFechaDia,
  upsertPilasLlenadoBatch,
  upsertPilaLlenado,
} from "@/modules/monitoreo/services/pilas-llenado";

const imagenSchema = z.object({
  url: z.string(),
  fileName: z.string(),
  mimeType: z.string().optional().default("image/jpeg"),
});

const rowSchema = z.object({
  finca: z.string().min(1),
  pilaFincaId: z.string().nullable().optional(),
  desmane: z.string().max(50).nullable().optional(),
  paneo: z.string().max(50).nullable().optional(),
  observaciones: z.string().max(500).nullable().optional(),
  imagenes: z.array(imagenSchema).optional(),
  fecha: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.coerce.date()]).optional(),
});

const batchSchema = z.object({
  fecha: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}/), z.coerce.date()]).optional(),
  rows: z.array(rowSchema).min(1),
});

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.operacion", "view")) return forbidden();

  try {
    const fechaParam = req.nextUrl.searchParams.get("fecha");
    let fecha: Date;
    try {
      fecha = parseFechaDia(fechaParam);
    } catch {
      return badRequest("Fecha inválida");
    }

    const withReport = req.nextUrl.searchParams.get("reporte") === "1";
    if (withReport) {
      const report = await buildReportePilasDia(fecha);
      return ok(report);
    }

    const rows = await listPilasLlenado(fecha);
    return ok(rows);
  } catch (e) {
    return serverError("Error al listar llenados de pilas", e);
  }
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.operacion", "edit")) return forbidden();

  try {
    const body = await req.json();
    const operador = {
      name: session.user.name ?? session.user.email ?? "Operador",
      id: session.user.id ?? null,
    };

    if (Array.isArray(body?.rows)) {
      const parsed = batchSchema.safeParse(body);
      if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
      const fecha = parseFechaDia(parsed.data.fecha ?? new Date());
      const rows = await upsertPilasLlenadoBatch(
        parsed.data.rows.map((r) => ({
          ...r,
          fecha: r.fecha ? parseFechaDia(r.fecha) : fecha,
        })),
        operador,
      );
      const report = await buildReportePilasDia(fecha);
      return created({ rows, report });
    }

    const parsed = rowSchema.safeParse(body);
    if (!parsed.success) return badRequest("Datos inválidos", parsed.error.flatten());
    const row = await upsertPilaLlenado({
      ...parsed.data,
      fecha: parsed.data.fecha ? parseFechaDia(parsed.data.fecha) : undefined,
      operadorName: operador.name,
      operadorId: operador.id,
    });
    return created(row);
  } catch (e) {
    return serverError("Error al registrar llenado de pilas", e);
  }
}
