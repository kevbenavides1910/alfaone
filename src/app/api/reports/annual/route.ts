import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/response";
import { getAnnualReport } from "@/modules/presupuestos/business/annualProfitability";
import { currentYearServer } from "@/lib/utils/time";
import { parseReportPartida } from "@/lib/utils/constants";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { searchParams } = new URL(req.url);
  const yearStr = searchParams.get("year");
  const company = searchParams.get("company");
  const companiesParam = searchParams.get("companies");

  const year = yearStr ? parseInt(yearStr) : currentYearServer();
  if (isNaN(year) || year < 2020 || year > 2100) return badRequest("Año inválido");

  const partida = parseReportPartida(searchParams.get("partida")) ?? undefined;

  let companyFilter: string | string[] | undefined = session.user.company ?? undefined;
  if (!companyFilter) {
    if (companiesParam) {
      const list = companiesParam
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
      companyFilter = list.length > 0 ? list : undefined;
    } else if (company) {
      companyFilter = company;
    }
  }

  try {
    // getAnnualReport hoy acepta una sola empresa; si hay lista, usar la primera.
    const companyArg = Array.isArray(companyFilter) ? companyFilter[0] : companyFilter;
    const report = await getAnnualReport(year, companyArg, partida);
    return ok(report);
  } catch (e) {
    return serverError("Error generando reporte anual", e);
  }
}
