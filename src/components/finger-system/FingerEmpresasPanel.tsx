"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useFingerCompany } from "@/components/finger-system/finger-company-context";

type CompanySummary = {
  code: string;
  name: string;
  isActive: boolean;
  deviceCount: number;
  linkedEmployees: number;
  shiftCount: number;
  punchesToday: number;
};

export function FingerEmpresasPanel() {
  const { companyCode, setCompanyCode, isMultiCompany } = useFingerCompany();
  const queryClient = useQueryClient();

  const listQuery = useQuery<{ data: CompanySummary[] }>({
    queryKey: ["finger-companies-summary"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/companies/summary", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al cargar empresas");
      return json;
    },
  });

  const selectMutation = useMutation({
    mutationFn: async (code: string) => {
      setCompanyCode(code);
      return code;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["finger-companies-summary"] }),
  });

  const rows = listQuery.data?.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Empresas biométricas</CardTitle>
        <p className="text-sm text-slate-500">
          ATT2016 es una sola base; la separación multiempresa se modela en PostgreSQL por código de
          empresa. Seleccione una empresa para filtrar otras pantallas.
        </p>
      </CardHeader>
      <CardContent>
        {listQuery.isLoading ? <p className="text-sm text-slate-500">Cargando…</p> : null}
        {listQuery.isError ? (
          <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
        ) : null}

        <div className="overflow-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left">Código</th>
                <th className="px-3 py-2 text-left">Nombre</th>
                <th className="px-3 py-2 text-left">Dispositivos</th>
                <th className="px-3 py-2 text-left">Empleados</th>
                <th className="px-3 py-2 text-left">Turnos</th>
                <th className="px-3 py-2 text-left">Marcas hoy</th>
                <th className="px-3 py-2 text-left">Acción</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.code} className="border-t">
                  <td className="px-3 py-2 font-mono text-xs">{c.code}</td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2">{c.deviceCount}</td>
                  <td className="px-3 py-2">{c.linkedEmployees}</td>
                  <td className="px-3 py-2">{c.shiftCount}</td>
                  <td className="px-3 py-2">{c.punchesToday}</td>
                  <td className="px-3 py-2">
                    {companyCode === c.code ? (
                      <Badge variant="default">Seleccionada</Badge>
                    ) : isMultiCompany ? (
                      <Button size="sm" variant="outline" onClick={() => selectMutation.mutate(c.code)}>
                        Seleccionar
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !listQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500">
                    No hay empresas activas en el catálogo.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
