"use client";

import { FingerShiftsPanel } from "@/components/finger-system/FingerShiftsPanel";

export default function FingerTurnosPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Turnos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Horarios de trabajo con tolerancias para el cálculo de asistencia. ATT2016 no tiene turnos
          configurados; defínalos aquí.
        </p>
      </div>
      <FingerShiftsPanel />
    </div>
  );
}
