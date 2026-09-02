"use client";

import { FingerAttendancePanel } from "@/components/finger-system/FingerAttendancePanel";

export default function FingerAsistenciaPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold">Asistencia</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Días con marcas desde Odoo (entrada/salida). Use Calcular para sincronizar cache e incidencias.
        </p>
      </div>
      <FingerAttendancePanel />
    </div>
  );
}
