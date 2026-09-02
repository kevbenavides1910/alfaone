"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type OdooPing = {
  ok: boolean;
  message: string;
  devices?: number;
  users?: number;
  punches?: number;
};

export function FingerOdooStatusPanel() {
  const query = useQuery<{ data: { odoo?: OdooPing } }>({
    queryKey: ["finger-odoo-status"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/dashboard", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al consultar Odoo");
      return json;
    },
  });

  const odoo = query.data?.data.odoo;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Conexión Odoo (padrón biométrico)</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Fuente de verdad: tablas <code className="text-xs">alfa_biometric_*</code> en Postgres Odoo
            (<code className="text-xs">ODOO_BIOMETRIC_DATABASE_URL</code>).
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={query.isFetching}
          onClick={() => query.refetch()}
        >
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />
          Probar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {query.isLoading ? <p className="text-muted-foreground">Consultando…</p> : null}
        {query.isError ? (
          <p className="text-red-600">{(query.error as Error).message}</p>
        ) : null}
        {odoo ? (
          <>
            <p className={odoo.ok ? "text-emerald-700 font-medium" : "text-amber-700 font-medium"}>
              {odoo.ok ? "Conectado" : "No conectado"} — {odoo.message}
            </p>
            {odoo.ok ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <Stat label="Relojes" value={odoo.devices ?? 0} />
                <Stat label="Usuarios" value={odoo.users ?? 0} />
                <Stat label="Marcas" value={odoo.punches ?? 0} />
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">
                Configure la variable de entorno en el contenedor y reinicie el servicio.
              </p>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value.toLocaleString("es-CR")}</p>
    </div>
  );
}
