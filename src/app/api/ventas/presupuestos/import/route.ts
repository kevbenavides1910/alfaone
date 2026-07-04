import { NextRequest } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { getSession } from "@/lib/api/middleware";
import { hasPermission } from "@/lib/permissions/check";
import { ok, badRequest, unauthorized, forbidden, serverError, created } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import {
  importPresupuestoFromPaniExcel,
  resolvePaniExcelPath,
} from "@/modules/ventas/services/presupuesto-pani-import";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "ventas.presupuestos", "edit")) return forbidden();

  try {
    const contentType = req.headers.get("content-type") ?? "";
    let filePath: string;
    let syncCatalog = true;
    let replaceExisting = true;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      syncCatalog = form.get("syncCatalog") !== "false";
      replaceExisting = form.get("replaceExisting") !== "false";

      if (file && file instanceof Blob) {
        const uploadDir = path.join(process.cwd(), "cargas");
        mkdirSync(uploadDir, { recursive: true });
        const original = (file as File).name || `pani-import-${Date.now()}.xlsx`;
        filePath = path.join(uploadDir, original);
        const buf = Buffer.from(await file.arrayBuffer());
        writeFileSync(filePath, buf);
      } else {
        const customPath = form.get("path");
        filePath = resolvePaniExcelPath(
          typeof customPath === "string" && customPath.trim() ? customPath.trim() : undefined
        );
      }
    } else {
      let body: { path?: string; syncCatalog?: boolean; replaceExisting?: boolean } = {};
      try {
        body = (await req.json()) as typeof body;
      } catch {
        body = {};
      }
      syncCatalog = body.syncCatalog !== false;
      replaceExisting = body.replaceExisting !== false;
      filePath = resolvePaniExcelPath(body.path);
    }

    const stats = await importPresupuestoFromPaniExcel(prisma, filePath, {
      syncCatalog,
      replaceExisting,
      userId: session.user.id,
    });

    return created({ ...stats, filePath });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error al importar Excel PANI";
    if (msg.includes("no encontrado") || msg.includes("no encontrada") || msg.includes("Ya existe")) {
      return badRequest(msg);
    }
    return serverError("Error al importar presupuesto desde Excel PANI", e);
  }
}
