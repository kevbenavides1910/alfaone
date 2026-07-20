"use client";

import { useEffect, useState } from "react";
import type { ViewerTheme } from "@/modules/tickets-ti/report-viewer/types";
import { REPORT_VIEWER_CONFIG } from "@/modules/tickets-ti/report-viewer/config/report-viewer.config";

export function useReportViewerTheme() {
  const [theme, setTheme] = useState<ViewerTheme>(REPORT_VIEWER_CONFIG.defaultTheme);

  useEffect(() => {
    const stored = localStorage.getItem(REPORT_VIEWER_CONFIG.themeStorageKey) as ViewerTheme | null;
    if (stored === "light" || stored === "dark") setTheme(stored);
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      localStorage.setItem(REPORT_VIEWER_CONFIG.themeStorageKey, next);
      return next;
    });
  }

  return { theme, toggleTheme, isDark: theme === "dark" };
}

export function viewerThemeClass(isDark: boolean): string {
  return isDark
    ? "rv-dark bg-slate-950 text-slate-100"
    : "rv-light bg-slate-50 text-slate-900";
}
