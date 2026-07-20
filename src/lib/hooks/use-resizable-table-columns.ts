"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_PREFIX = "alfa-table-col-widths:";
export const TABLE_COL_MIN_PX = 64;
export const TABLE_COL_MAX_PX = 1200;

export type ColumnWidths = Record<string, number>;

export function tableColumnStorageKey(tableId: string): string {
  return `${STORAGE_PREFIX}${tableId}`;
}

export function loadColumnWidths(tableId: string): ColumnWidths {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(tableColumnStorageKey(tableId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    const out: ColumnWidths = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v);
      if (Number.isFinite(n) && n >= TABLE_COL_MIN_PX) {
        out[k] = Math.min(TABLE_COL_MAX_PX, Math.round(n));
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function saveColumnWidths(tableId: string, widths: ColumnWidths): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(tableColumnStorageKey(tableId), JSON.stringify(widths));
  } catch {
    /* quota / private mode */
  }
}

export function clampColumnWidth(px: number): number {
  return Math.min(TABLE_COL_MAX_PX, Math.max(TABLE_COL_MIN_PX, Math.round(px)));
}

/**
 * Anchos de columna persistidos en localStorage por `tableId`.
 */
export function useResizableTableColumns(tableId: string) {
  const [widths, setWidths] = useState<ColumnWidths>({});

  useEffect(() => {
    setWidths(loadColumnWidths(tableId));
  }, [tableId]);

  const setColumnWidth = useCallback(
    (key: string, px: number) => {
      setWidths((prev) => {
        const next = { ...prev, [key]: clampColumnWidth(px) };
        saveColumnWidths(tableId, next);
        return next;
      });
    },
    [tableId],
  );

  const getWidth = useCallback(
    (key: string, fallback?: number) => widths[key] ?? fallback,
    [widths],
  );

  return { widths, setColumnWidth, getWidth };
}
