import type { ReportDataset } from "../types";

/** Contrato para proveedores de datos del dashboard (API, SQL, etc.). */
export interface IDataProvider {
  load(onProgress?: (percent: number, message?: string) => void): Promise<ReportDataset>;
}

export type ApiHistoryParams = {
  dateFrom: string;
  dateTo: string;
  filterType: "technician" | "user";
  personId?: string;
  statusGroups: string[];
};
