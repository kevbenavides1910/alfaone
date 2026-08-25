"use client";

import { FingerReportsPanel } from "@/components/finger-system/FingerReportsPanel";

export default function FingerReportesPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reportes</h1>
        <p className="mt-1 text-sm text-slate-600">
          Resumen de asistencia por rango de fechas y exportación CSV para Planillas.
        </p>
      </div>
      <FingerReportsPanel />
    </div>
  );
}
