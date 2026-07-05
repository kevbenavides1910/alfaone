"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Smartphone, Route } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type RouteRow = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  phonesCount: number;
  pointsCount: number;
  contract: { licitacionNo: string; client: string } | null;
};

export default function RutasPermitidasPage() {
  const { data, isLoading } = useQuery<{ data: RouteRow[] }>({
    queryKey: ["patrol-routes-list"],
    queryFn: () => fetch("/api/admin/patrol/routes").then((r) => r.json()),
  });

  const routes = data?.data ?? [];

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-rose-600" />
          Rutas permitidas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Asigne qué celulares (IMEI) pueden operar cada ruta en la app móvil. La configuración de
          puntos NFC y horarios está en la pestaña <strong>Rutas</strong>.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Rutas y celulares autorizados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Cargando rutas…</p>
          ) : routes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay rutas configuradas.</p>
          ) : (
            <div className="space-y-2">
              {routes.map((route) => (
                <div
                  key={route.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-medium">{route.code}</span>
                      <Badge variant={route.isActive ? "success" : "secondary"}>
                        {route.isActive ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium truncate">{route.name}</p>
                    {route.contract ? (
                      <p className="text-xs text-muted-foreground truncate">
                        {route.contract.licitacionNo} · {route.contract.client}
                      </p>
                    ) : null}
                    <p className="text-xs text-muted-foreground mt-1">
                      {route.phonesCount} celular(es) · {route.pointsCount} punto(s)
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/recorridos/rutas-permitidas/${route.id}`}>
                      <Route className="h-4 w-4 mr-2" />
                      Gestionar celulares
                    </Link>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
