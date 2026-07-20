import { NextRequest } from "next/server";
import { writeFileSync, mkdirSync } from "fs";
import path from "path";
import { getSession, requirePermission } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, forbidden, serverError } from "@/lib/api/response";
import { prisma } from "@/modules/core/db/prisma";
import { importBandecoFromXlsm } from "@/modules/monitoreo/services/import-xlsm";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!requirePermission(session, "monitoreo.mantenimientos", "admin")) return forbidden();

  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!file || !(file instanceof Blob)) {
      return badRequest("Archivo .xlsm requerido");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const uploadDir = path.join(process.cwd(), "cargas");
    mkdirSync(uploadDir, { recursive: true });
    const filePath = path.join(uploadDir, `bandeco-import-${Date.now()}.xlsm`);
    writeFileSync(filePath, buf);

    const stats = await importBandecoFromXlsm(filePath, prisma);
    return ok({ stats, filePath });
  } catch (e) {
    return serverError("Error al importar archivo Bandeco", e);
  }
}
