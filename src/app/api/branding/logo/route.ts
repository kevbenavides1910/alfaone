import { readBrandingLogoFile } from "@/modules/plataforma/services/app-branding";
import { notFound, serverError } from "@/lib/api/response";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const logo = await readBrandingLogoFile();
    if (!logo) return notFound("Sin logo configurado");

    return new NextResponse(new Uint8Array(logo.buffer), {
      status: 200,
      headers: {
        "Content-Type": logo.mime,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    return serverError("Error al servir logo", e);
  }
}
