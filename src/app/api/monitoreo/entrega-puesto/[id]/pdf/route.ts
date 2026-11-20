import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api/handler";
import { notFound } from "@/lib/api/response";
import { getEntregaPuesto } from "@/modules/monitoreo/services/entrega-puesto";
import { buildEntregaPuestoPdf } from "@/modules/monitoreo/services/entrega-puesto-pdf";

export const GET = apiHandler(
  { permission: ["monitoreo.operacion", "view"], errorLabel: "Error al generar el PDF de la entrega" },
  async ({ params }) => {
    const { id } = await params;
    const row = await getEntregaPuesto(String(id));
    if (!row) return notFound("Entrega no encontrada");
    const bytes = await buildEntregaPuestoPdf(row);
    const filename = `entrega-puesto-${row.fecha}-${row.hora.replace(":", "")}.pdf`;
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
