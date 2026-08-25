"use client";

import { FingerPunchesImportPanel } from "@/components/finger-system/FingerPunchesImportPanel";
import { FingerAttendancePanel } from "@/components/finger-system/FingerAttendancePanel";

export default function FingerAsistenciaPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Asistencia</h1>
        <p className="mt-1 text-sm text-slate-600">
          Importe marcas desde ATT2016 y calcule incidencias diarias (presente, ausente, tardía, incompleto).
        </p>
      </div>
      <FingerAttendancePanel />
      <FingerPunchesImportPanel />
    </div>
  );
}
