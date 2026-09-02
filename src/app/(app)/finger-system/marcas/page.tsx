"use client";

import { FingerPunchesHistoryPanel } from "@/components/finger-system/FingerPunchesHistoryPanel";
import { FingerLivePunchesPanel } from "@/components/finger-system/FingerLivePunchesPanel";

export default function FingerMarcasPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Marcas biométricas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Historial filtrable (relojes ZK y ATT2016) y vista en vivo de las últimas marcas importadas.
        </p>
      </div>
      <FingerPunchesHistoryPanel />
      <div>
        <h2 className="text-base font-semibold text-slate-800 mb-2">En vivo</h2>
        <FingerLivePunchesPanel />
      </div>
    </div>
  );
}
