"use client";

import { FingerBiometricsPanel } from "@/components/finger-system/FingerBiometricsPanel";

export default function FingerBiometriaPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Biometría</h1>
        <p className="mt-1 text-sm text-slate-600">
          Estado de huellas por empleado. Sincroniza contadores desde ATT2016 (tabla TEMPLATE) hacia PostgreSQL.
        </p>
      </div>
      <FingerBiometricsPanel />
    </div>
  );
}
