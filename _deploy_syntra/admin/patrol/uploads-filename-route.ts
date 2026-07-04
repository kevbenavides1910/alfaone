import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { withPermission } from "@/lib/permissions/middleware";
import { patrolUploadRoot } from "@/modules/syntra/services/patrol-image-store";

function mimeForFile(fileName: string): string {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export const GET = withPermission<{ fileName: string }>(async (_req, { params }) => {
  const { fileName } = params;
  if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
    return NextResponse.json({ error: { message: "Archivo no encontrado" } }, { status: 404 });
  }

  const abs = path.join(patrolUploadRoot(), fileName);
  try {
    const buf = await readFile(abs);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": mimeForFile(fileName),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: { message: "Archivo no encontrado" } }, { status: 404 });
  }
}, "recorridos.reportes", "view");
