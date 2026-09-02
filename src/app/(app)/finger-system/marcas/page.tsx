"use client";

import { FingerPunchesHistoryPanel } from "@/components/finger-system/FingerPunchesHistoryPanel";
import { FingerLivePunchesPanel } from "@/components/finger-system/FingerLivePunchesPanel";

export default function FingerMarcasPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Marcas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historial desde Odoo. Use «Traer marcas» para bajar las del reloj ZK.
        </p>
      </div>
      <FingerPunchesHistoryPanel />
      <div>
        <h2 className="mb-2 text-base font-semibold">En vivo</h2>
        <FingerLivePunchesPanel />
      </div>
    </div>
  );
}
