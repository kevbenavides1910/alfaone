import { withPermission } from "@/lib/permissions/middleware";
import { notFound, serverError } from "@/lib/api/response";
import {
  MonthlyReportError,
  readMonthlyReportTemplate,
} from "@/modules/informes-mensuales/services/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withPermission(async () => {
  try {
    const buffer = await readMonthlyReportTemplate();
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="INFORME_DEL_MONTE_base.xlsx"`,
        "Content-Length": String(buffer.length),
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof MonthlyReportError) return notFound(error.message);
    return serverError("Error al descargar la plantilla base", error);
  }
}, "informesMensuales.informes");
