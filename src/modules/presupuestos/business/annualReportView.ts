import { calcTrafficLight, type ReportPartidaFilter, type TrafficLight } from "@/lib/utils/constants";

export interface MonthCell {
  month: number;
  monthlyBilling: number;
  /** Presupuesto de la partida activa (en ALL: suma MO+Insumos+Adm. para referencia; el detalle va en `partidaAllDetail`) */
  lineBudget: number;
  totalExpenses: number;
  surplus: number;
  hasData: boolean;
  trafficLight: TrafficLight;
  /** Desglose cuando el reporte es “todas las partidas” (semáforo y superávit vs. mensual). */
  partidaAllDetail?: {
    laborBudget: number;
    suppliesBudget: number;
    adminBudget: number;
    laborSpend: number;
    suppliesSpend: number;
    adminSpend: number;
    /** Gastos directos sin partida (budgetLine nulo); no entran en MO/Ins/Adm hasta asignarlos */
    unassignedSpend: number;
  };
}

export interface AnnualReportRow {
  contractId: string;
  licitacionNo: string;
  company: string;
  client: string;
  status: string;
  months: MonthCell[];
  annualBudget: number;
  annualExpenses: number;
  annualSurplus: number;
}

export interface AnnualReport {
  year: number;
  partida: ReportPartidaFilter;
  rows: AnnualReportRow[];
  monthlyTotals: { month: number; budget: number; expenses: number; surplus: number }[];
  grandBudget: number;
  grandExpenses: number;
  grandSurplus: number;
}

function projectMonthCell(cell: MonthCell, partida: ReportPartidaFilter): MonthCell {
  if (partida === "ALL" || !cell.partidaAllDetail) return cell;
  const d = cell.partidaAllDetail;
  const laborB = d.laborBudget;
  const supB = d.suppliesBudget;
  const admB = d.adminBudget;
  let lineBudget: number;
  let totalExpenses: number;
  let usage = 0;
  if (partida === "LABOR") {
    lineBudget = laborB;
    totalExpenses = d.laborSpend;
    usage = laborB > 0 ? d.laborSpend / laborB : 0;
  } else if (partida === "SUPPLIES") {
    lineBudget = supB;
    totalExpenses = d.suppliesSpend;
    usage = supB > 0 ? d.suppliesSpend / supB : 0;
  } else {
    lineBudget = admB;
    totalExpenses = d.adminSpend;
    usage = admB > 0 ? d.adminSpend / admB : 0;
  }
  return {
    ...cell,
    lineBudget,
    totalExpenses,
    surplus: lineBudget - totalExpenses,
    trafficLight: cell.hasData && lineBudget > 0 ? calcTrafficLight(usage) : "GREEN",
  };
}

/** Recalcula celdas/totales de una partida sin volver a consultar BD. */
export function projectAnnualReportPartida(
  report: AnnualReport,
  partida: ReportPartidaFilter,
): AnnualReport {
  if (partida === "ALL" || report.partida === partida) {
    return { ...report, partida };
  }
  const rows = report.rows.map((row) => {
    const months = row.months.map((cell) => projectMonthCell(cell, partida));
    return {
      ...row,
      months,
      annualBudget: months.reduce((s, m) => s + (m.hasData ? m.lineBudget : 0), 0),
      annualExpenses: months.reduce((s, m) => s + m.totalExpenses, 0),
      annualSurplus: months.reduce((s, m) => s + m.surplus, 0),
    };
  });
  const monthlyTotals = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    budget: rows.reduce((s, r) => s + r.months[i].lineBudget, 0),
    expenses: rows.reduce((s, r) => s + r.months[i].totalExpenses, 0),
    surplus: rows.reduce((s, r) => s + r.months[i].surplus, 0),
  }));
  return {
    ...report,
    partida,
    rows,
    monthlyTotals,
    grandBudget: rows.reduce((s, r) => s + r.annualBudget, 0),
    grandExpenses: rows.reduce((s, r) => s + r.annualExpenses, 0),
    grandSurplus: rows.reduce((s, r) => s + r.annualSurplus, 0),
  };
}
