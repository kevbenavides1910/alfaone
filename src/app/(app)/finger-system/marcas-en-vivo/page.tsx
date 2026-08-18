"use client";

import { FingerLivePunchesPanel } from "@/components/finger-system/FingerLivePunchesPanel";

export default function FingerMarcasEnVivoPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Marcas en vivo</h1>
        <p className="mt-1 text-sm text-slate-600">
          Visualización en tiempo casi real de marcas importadas (SSE cada 10 segundos).
        </p>
      </div>
      <FingerLivePunchesPanel />
    </div>
  );
}
