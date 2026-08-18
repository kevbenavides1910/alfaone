"use client";

import { FingerAuditPanel } from "@/components/finger-system/FingerAuditPanel";

export default function FingerAuditoriaPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Auditoría</h1>
        <p className="mt-1 text-sm text-slate-600">
          Historial de operaciones y sincronizaciones del Finger System.
        </p>
      </div>
      <FingerAuditPanel />
    </div>
  );
}
