"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FingerAccessModeBadge } from "@/components/finger-system/FingerAccessModeBadge";
import { FingerAtt2016ConnectionPanel } from "@/components/finger-system/FingerAtt2016ConnectionPanel";
import { FingerConfigAdminPanel } from "@/components/finger-system/FingerConfigAdminPanel";
import { FingerConfigReadOnlyPanel } from "@/components/finger-system/FingerConfigReadOnlyPanel";
import { FingerOdooStatusPanel } from "@/components/finger-system/FingerOdooStatusPanel";
import { useFingerPermissions } from "@/components/finger-system/use-finger-permissions";

export default function FingerConfiguracionPage() {
  const { canViewConfig, canAdminConfig, loading } = useFingerPermissions();

  if (loading) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-muted-foreground">Cargando permisos…</p>
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
          <h1 className="text-xl font-semibold">Configuración</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Estado Odoo y opciones del módulo. ATT2016 queda como legado.
          </p>
        </div>
        <FingerAccessModeBadge />
      </div>

      <FingerOdooStatusPanel />

      {canAdminConfig ? <FingerConfigAdminPanel /> : <FingerConfigReadOnlyPanel />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Herramientas</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <a className="underline text-primary" href="/finger-system/mantenimiento">
            Mantenimiento
          </a>
          <a className="underline text-primary" href="/finger-system/auditoria">
            Auditoría
          </a>
          <a className="underline text-primary" href="/finger-system/biometria">
            Biometría (legado)
          </a>
        </CardContent>
      </Card>

      {canAdminConfig ? (
        <details className="rounded-xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">
            Legado ATT2016 (solo si aún se necesita)
          </summary>
          <div className="mt-4 space-y-4">
            <FingerAtt2016ConnectionPanel />
            <p className="text-xs text-muted-foreground">
              <a className="underline" href="/finger-system/backups">
                Backups ATT2016
              </a>
              {" · "}
              Credenciales SMB se guardan cifradas en Finger; no use ATT2016_SMB_* en el servidor.
            </p>
          </div>
        </details>
      ) : null}
    </div>
  );
}
