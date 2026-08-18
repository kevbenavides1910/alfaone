"use client";

import { FingerAccessModeBadge } from "@/components/finger-system/FingerAccessModeBadge";
import { FingerDevicesPanel } from "@/components/finger-system/FingerDevicesPanel";
import { useFingerPermissions } from "@/components/finger-system/use-finger-permissions";

export default function FingerDispositivosPage() {
  const { canViewDevices, loading, isBiometricAdmin } = useFingerPermissions();

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-slate-500">Cargando…</p>
      </div>
    );
  }

  if (!canViewDevices) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-red-600">No tiene permiso para ver dispositivos biométricos.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dispositivos biométricos</h1>
          <p className="mt-1 text-sm text-slate-600">
            {isBiometricAdmin
              ? "Administre relojes por IP y conecte equipos en red."
              : "Vista operativa: consulte relojes, conecte y actualice contadores. La ruta ATT2016 se configura en Configuración (admin)."}
          </p>
        </div>
        <FingerAccessModeBadge />
      </div>
      <FingerDevicesPanel />
    </div>
  );
}
