"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FingerAccessModeBadge } from "@/components/finger-system/FingerAccessModeBadge";
import { FingerAtt2016ConnectionPanel } from "@/components/finger-system/FingerAtt2016ConnectionPanel";
import { FingerConfigAdminPanel } from "@/components/finger-system/FingerConfigAdminPanel";
import { FingerConfigReadOnlyPanel } from "@/components/finger-system/FingerConfigReadOnlyPanel";
import { useFingerPermissions } from "@/components/finger-system/use-finger-permissions";

export default function FingerConfiguracionPage() {
  const { canViewConfig, canAdminConfig, loading } = useFingerPermissions();

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-slate-500">Cargando permisos…</p>
      </div>
    );
  }

  if (!canViewConfig) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-red-600">No tiene permiso para ver la configuración biométrica.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Configuración biométrica</h1>
          <p className="mt-1 text-sm text-slate-600">
            {canAdminConfig
              ? "Administración: seleccione la ruta ATT2016, reconozca la base y ajuste el módulo."
              : "Consulta de la configuración activa. Los cambios requieren rol administrador biométrico."}
          </p>
        </div>
        <FingerAccessModeBadge />
      </div>

      {canAdminConfig ? (
        <>
          <FingerAtt2016ConnectionPanel />
          <FingerConfigAdminPanel />
        </>
      ) : (
        <FingerConfigReadOnlyPanel />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Credenciales de red</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-slate-600">
          <p>
            El usuario y contraseña SMB se configuran en el diálogo <strong>Propiedades de vínculo de datos</strong>.
            Deben tener permiso de lectura y administración en la carpeta compartida (DB-Biometrico).
          </p>
          <p className="text-slate-500">
            La contraseña se almacena cifrada en la base de datos de Finger System; no use variables
            ATT2016_SMB_* en el servidor.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
