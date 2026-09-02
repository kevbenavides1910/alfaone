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
          <h1 className="text-xl font-semibold">Relojes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isBiometricAdmin
              ? "Conecte, edite y traiga usuarios/marcas desde los relojes ZK (TCP 4370)."
              : "Consulte estado de relojes, conecte y traiga marcas. El padrón vive en Odoo."}
          </p>
        </div>
        <FingerAccessModeBadge />
      </div>
      <FingerDevicesPanel />
    </div>
  );
}
