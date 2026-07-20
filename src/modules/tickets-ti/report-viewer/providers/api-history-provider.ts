"use client";

import { cleanImportedData } from "../engine/data-cleaner";
import type { ApiHistoryParams } from "./types";
import type { ReportDataset } from "../types";

/** Proveedor de datos desde Historial de Tickets (API REST). */
export class ApiHistoryDataProvider {
  constructor(private readonly params: ApiHistoryParams) {}

  async load(onProgress?: (percent: number, message?: string) => void): Promise<ReportDataset> {
    onProgress?.(10, "Consultando historial de tickets…");

    const qs = new URLSearchParams({
      dateFrom: this.params.dateFrom,
      dateTo: this.params.dateTo,
      filterType: this.params.filterType,
      statusGroups: this.params.statusGroups.join(","),
    });
    if (this.params.personId) qs.set("personId", this.params.personId);

    const r = await fetch(`/api/tickets-ti/reports/viewer?${qs.toString()}`);
    const json = await r.json();
    if (!r.ok || json.error) {
      throw new Error(json?.error?.message ?? "No se pudo cargar el historial");
    }

    onProgress?.(80, "Procesando registros…");
    const payload = json.data as { rows: Record<string, unknown>[]; warnings?: string[] };
    const rawRows = payload.rows ?? [];
    const headers = rawRows.length > 0 ? Object.keys(rawRows[0]) : [];
    const cleaned = cleanImportedData(rawRows, headers);

    onProgress?.(100, "Listo");

    return {
      rows: cleaned.rows,
      columns: cleaned.columns,
      warnings: [...(payload.warnings ?? []), ...cleaned.warnings],
      source: "api",
      loadedAt: new Date().toISOString(),
      recordCount: cleaned.rows.length,
    };
  }
}

export async function loadHistoryFromApi(
  params: ApiHistoryParams,
  onProgress?: (percent: number, message?: string) => void
): Promise<ReportDataset> {
  return new ApiHistoryDataProvider(params).load(onProgress);
}
