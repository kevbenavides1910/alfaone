"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  TABLE_COL_MIN_PX,
  clampColumnWidth,
  loadColumnWidths,
  saveColumnWidths,
  type ColumnWidths,
} from "@/lib/hooks/use-resizable-table-columns";

const HANDLE_CLASS = "alfa-col-resize-handle";
const READY_ATTR = "data-alfa-resize-ready";
const TABLE_ID_ATTR = "data-table-id";

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 40);
}

function headerLabels(table: HTMLTableElement): string[] {
  const firstRow =
    table.tHead?.rows?.[0] ??
    table.querySelector("thead tr") ??
    table.querySelector("tr");
  if (!firstRow) return [];
  return Array.from(firstRow.querySelectorAll("th")).map((th, i) => {
    const existing = th.getAttribute("data-col-key");
    if (existing) return existing;
    const text = (th.textContent ?? "").replace(/\s+/g, " ").trim() || `col-${i}`;
    return slug(text) || `col-${i}`;
  });
}

function resolveTableId(table: HTMLTableElement, pathname: string, index: number): string {
  const explicit = table.getAttribute(TABLE_ID_ATTR)?.trim();
  if (explicit) return explicit;
  const labels = headerLabels(table).slice(0, 6).join("_");
  return `${pathname || "/"}::${index}::${labels || "table"}`;
}

function applyWidths(table: HTMLTableElement, widths: ColumnWidths, keys: string[]) {
  table.style.tableLayout = "fixed";
  const rows = Array.from(table.querySelectorAll("tr"));
  for (const row of rows) {
    const cells = Array.from(row.children).filter(
      (el): el is HTMLTableCellElement => el.tagName === "TH" || el.tagName === "TD",
    );
    cells.forEach((cell, i) => {
      const key = keys[i];
      if (!key) return;
      const w = widths[key];
      if (w == null) return;
      cell.style.width = `${w}px`;
      cell.style.minWidth = `${w}px`;
      cell.style.maxWidth = `${w}px`;
      // Permitir ver más texto al ensanchar (rompe truncate fijo de CSS)
      if (cell.tagName === "TD") {
        // No forzar nowrap: respeta celdas multilínea; el usuario ensancha para ver más.
        cell.style.overflow = "hidden";
        cell.style.textOverflow = "ellipsis";
      }
    });
  }
}

function attachHandles(table: HTMLTableElement, tableId: string, keys: string[]) {
  const firstRow =
    table.tHead?.rows?.[0] ??
    (table.querySelector("thead tr") as HTMLTableRowElement | null) ??
    (table.querySelector("tr") as HTMLTableRowElement | null);
  if (!firstRow) return;

  const ths = Array.from(firstRow.querySelectorAll("th"));
  ths.forEach((th, i) => {
    const key = keys[i] ?? `col-${i}`;
    th.setAttribute("data-col-key", key);
    // No pisar sticky: relative + left-* solapa encabezados (p. ej. revisión planilla NAF).
    if (!th.classList.contains("sticky") && !th.style.position) {
      th.style.position = "relative";
    }

    if (th.querySelector(`.${HANDLE_CLASS}`)) return;
    // Ya tiene ResizableTh nativo
    if (th.querySelector('[role="separator"][aria-orientation="vertical"]')) return;

    const handle = document.createElement("span");
    handle.className = HANDLE_CLASS;
    handle.setAttribute("role", "separator");
    handle.setAttribute("aria-orientation", "vertical");
    handle.setAttribute("aria-label", `Redimensionar columna ${key}`);
    handle.tabIndex = 0;
    Object.assign(handle.style, {
      position: "absolute",
      right: "0",
      top: "0",
      height: "100%",
      width: "6px",
      cursor: "col-resize",
      userSelect: "none",
      zIndex: "20",
      touchAction: "none",
    } as CSSStyleDeclaration);

    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const startX = e.clientX;
      const startW = th.getBoundingClientRect().width;
      handle.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const next = clampColumnWidth(startW + (ev.clientX - startX));
        const widths = loadColumnWidths(tableId);
        widths[key] = next;
        saveColumnWidths(tableId, widths);
        applyWidths(table, widths, keys);
      };
      const onUp = (ev: PointerEvent) => {
        try {
          handle.releasePointerCapture(ev.pointerId);
        } catch {
          /* already released */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });

    th.appendChild(handle);
  });
}

function enhanceTable(table: HTMLTableElement, pathname: string, index: number) {
  if (table.getAttribute(READY_ATTR) === "1") {
    // Re-apply widths (filas virtualizadas / re-render)
    const tableId = table.getAttribute(TABLE_ID_ATTR) || resolveTableId(table, pathname, index);
    const keys = headerLabels(table);
    applyWidths(table, loadColumnWidths(tableId), keys);
    return;
  }
  if (table.querySelectorAll("th").length === 0) return;

  const tableId = resolveTableId(table, pathname, index);
  table.setAttribute(TABLE_ID_ATTR, tableId);
  table.setAttribute(READY_ATTR, "1");

  const keys = headerLabels(table);
  // Ancho mínimo inicial si la columna está demasiado estrecha
  const widths = loadColumnWidths(tableId);
  keys.forEach((key, i) => {
    if (widths[key] != null) return;
    const th = table.tHead?.rows?.[0]?.cells?.[i];
    if (!th) return;
    const w = th.getBoundingClientRect().width;
    if (w > 0 && w < TABLE_COL_MIN_PX) widths[key] = TABLE_COL_MIN_PX;
  });

  attachHandles(table, tableId, keys);
  applyWidths(table, widths, keys);
}

/**
 * Activa redimensionado de columnas en todas las <table> de la app.
 * Persiste anchos en localStorage por ruta + columnas.
 */
export function EnableTableColumnResize() {
  const pathname = usePathname() || "/";

  useEffect(() => {
    let scheduled = 0;
    const scan = () => {
      const tables = Array.from(document.querySelectorAll("table"));
      tables.forEach((t, i) => enhanceTable(t as HTMLTableElement, pathname, i));
    };
    const schedule = () => {
      cancelAnimationFrame(scheduled);
      scheduled = requestAnimationFrame(scan);
    };

    schedule();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      mo.disconnect();
      cancelAnimationFrame(scheduled);
    };
  }, [pathname]);

  return null;
}
