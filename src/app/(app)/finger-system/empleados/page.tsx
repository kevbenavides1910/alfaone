"use client";

import { FingerEmployeesImportPanel } from "@/components/finger-system/FingerEmployeesImportPanel";
import { FingerEmployeesTable } from "@/components/finger-system/FingerEmployeesTable";

export default function FingerEmpleadosPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Empleados biométricos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Vincule empleados de ATT2016 con el directorio RRHH de Alfa One. En Fase 3 puede crear vínculos manuales
          y dar de alta en ATT2016 con USERID seguro (MAX+1).
        </p>
      </div>
      <FingerEmployeesTable />
      <FingerEmployeesImportPanel />
    </div>
  );
}
