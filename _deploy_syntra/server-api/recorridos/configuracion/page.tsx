"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";

type Settings = {
  enableGeofences: boolean;
  enableGpsTrack: boolean;
  geofenceRadiusM: number;
  routesSyncMinutes: number;
  reportsSyncMinutes: number;
};

export default function RecorridosConfigPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ data: Settings }>({
    queryKey: ["patrol-settings"],
    queryFn: () => fetch("/api/admin/patrol/settings").then((r) => r.json()),
  });

  const [form, setForm] = useState<Settings | null>(null);
  const settings = form ?? data?.data;

  const save = useMutation({
    mutationFn: async (body: Settings) => {
      const res = await fetch("/api/admin/patrol/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, enableGpsTrack: true }),
      });
      if (!res.ok) throw new Error("No se pudo guardar");
      return res.json();
    },
    onSuccess: () => {
      toast.success("Configuración guardada");
      qc.invalidateQueries({ queryKey: ["patrol-settings"] });
    },
    onError: () => toast.error("Error al guardar"),
  });

  if (isLoading || !settings) {
    return <div className="p-8 text-sm text-muted-foreground">Cargando configuración…</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto w-full space-y-6">
      <div>
        <h1 className="text-xl font-bold">Configuración de la app SYNTRA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Parámetros remotos que la app consulta en <code>/api/syntra/config</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funciones móviles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={settings.enableGeofences}
              onChange={(e) => setForm({ ...settings, enableGeofences: e.target.checked })}
            />
            Habilitar geocercas
          </label>
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <p className="font-medium">Rastreo GPS</p>
            <p className="text-muted-foreground mt-1">
              Siempre activo en la app. Los dispositivos envían ubicación automáticamente al iniciar sesión.
            </p>
          </div>
          <div>
            <Label htmlFor="radius">Radio geocerca (metros)</Label>
            <Input
              id="radius"
              type="number"
              min={10}
              max={5000}
              value={settings.geofenceRadiusM}
              onChange={(e) =>
                setForm({ ...settings, geofenceRadiusM: Number(e.target.value) || 100 })
              }
              className="mt-1 max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sincronización en segundo plano</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="routesSync">Rutas (minutos)</Label>
            <Input
              id="routesSync"
              type="number"
              min={5}
              max={1440}
              value={settings.routesSyncMinutes}
              onChange={(e) =>
                setForm({ ...settings, routesSyncMinutes: Number(e.target.value) || 360 })
              }
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="reportsSync">Marcas pendientes (minutos)</Label>
            <Input
              id="reportsSync"
              type="number"
              min={5}
              max={1440}
              value={settings.reportsSyncMinutes}
              onChange={(e) =>
                setForm({ ...settings, reportsSyncMinutes: Number(e.target.value) || 30 })
              }
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      <Button onClick={() => save.mutate(settings)} disabled={save.isPending}>
        Guardar cambios
      </Button>
    </div>
  );
}
