"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/toaster";
import {
  feApiUrl,
  useFeCompany,
  withFeCompanyBody,
} from "@/components/facturacion-electronica/fe-company-context";

type ProveedorRow = {
  id: string;
  cedula: string;
  nombre: string | null;
  autoAceptar: boolean;
  isActive: boolean;
};

export function FeProveedoresConfianzaCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { companyCode } = useFeCompany();
  const [cedula, setCedula] = useState("");
  const [nombre, setNombre] = useState("");

  const listQ = useQuery({
    queryKey: ["fe-proveedores-confianza", companyCode],
    queryFn: async (): Promise<ProveedorRow[]> => {
      const r = await fetch(feApiUrl("/api/fe/proveedores-confianza", companyCode));
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al cargar");
      return j.data as ProveedorRow[];
    },
    enabled: Boolean(companyCode),
  });

  const addM = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/fe/proveedores-confianza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          withFeCompanyBody({ cedula, nombre: nombre.trim() || undefined, autoAceptar: true }, companyCode)
        ),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al agregar");
    },
    onSuccess: () => {
      toast.success("Proveedor agregado");
      setCedula("");
      setNombre("");
      void qc.invalidateQueries({ queryKey: ["fe-proveedores-confianza", companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeM = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(feApiUrl(`/api/fe/proveedores-confianza/${id}`, companyCode), { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error?.message ?? "Error al eliminar");
    },
    onSuccess: () => {
      toast.success("Proveedor eliminado");
      void qc.invalidateQueries({ queryKey: ["fe-proveedores-confianza", companyCode] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-4 w-4" />
          Proveedores de confianza
        </CardTitle>
        <CardDescription>
          Facturas con XML de estos proveedores se aceptan automáticamente ante Hacienda (mensaje receptor tipo 1).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {canEdit && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Cédula</Label>
              <Input value={cedula} onChange={(e) => setCedula(e.target.value)} placeholder="3101…" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Nombre (opcional)</Label>
              <div className="flex gap-2">
                <Input value={nombre} onChange={(e) => setNombre(e.target.value)} />
                <Button onClick={() => addM.mutate()} disabled={addM.isPending || cedula.length < 9}>
                  Agregar
                </Button>
              </div>
            </div>
          </div>
        )}
        <ul className="divide-y rounded-md border text-sm">
          {(listQ.data ?? []).length === 0 && (
            <li className="px-3 py-4 text-muted-foreground">Sin proveedores configurados.</li>
          )}
          {(listQ.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <div>
                <span className="font-mono">{p.cedula}</span>
                {p.nombre ? <span className="ml-2 text-muted-foreground">{p.nombre}</span> : null}
              </div>
              <div className="flex items-center gap-2">
                {p.autoAceptar && (
                  <span className="text-xs text-green-700">Auto</span>
                )}
                {canEdit && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => removeM.mutate(p.id)}
                    disabled={removeM.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
