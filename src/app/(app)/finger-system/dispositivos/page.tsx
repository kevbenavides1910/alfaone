"use client";

import { FingerDevicesPanel } from "@/components/finger-system/FingerDevicesPanel";

export default function FingerDispositivosPage() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Dispositivos biométricos</h1>
        <p className="mt-1 text-sm text-slate-600">
          Registro, importación desde ATT2016 y verificación de conectividad TCP 4370 (ZKTeco).
        </p>
      </div>
      <FingerDevicesPanel />
    </div>
  );
}
