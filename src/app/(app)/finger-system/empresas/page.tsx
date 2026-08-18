"use client";

import { FingerEmpresasPanel } from "@/components/finger-system/FingerEmpresasPanel";

export default function FingerEmpresasPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Empresas</h1>
        <p className="mt-1 text-sm text-slate-600">
          Resumen biométrico por empresa y selección de contexto multiempresa.
        </p>
      </div>
      <FingerEmpresasPanel />
    </div>
  );
}
