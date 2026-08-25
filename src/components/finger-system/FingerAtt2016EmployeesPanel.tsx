"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Att2016UserRow = {
  attUserId: number;
  badgeNumber: string;
  name: string | null;
  attEnabled: boolean;
};

export function FingerAtt2016EmployeesPanel() {
  const usersQuery = useQuery<{ data: { total: number; items: Att2016UserRow[] } }>({
    queryKey: ["finger-att2016-users"],
    queryFn: async () => {
      const res = await fetch("/api/finger-system/att2016/users", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al leer USERINFO");
      return json;
    },
  });

  const data = usersQuery.data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Usuarios en ATT2016 (USERINFO)</CardTitle>
        <p className="text-sm text-slate-500">
          Lista directa desde la base Microsoft Access. No requiere vinculación con el directorio RRHH
          de Alfa One.
        </p>
      </CardHeader>
      <CardContent>
        {usersQuery.isLoading ? <p className="text-sm text-slate-500">Leyendo ATT2016…</p> : null}
        {usersQuery.isError ? (
          <p className="text-sm text-red-600">{(usersQuery.error as Error).message}</p>
        ) : null}

        {data ? (
          <>
            <p className="mb-3 text-sm text-slate-600">
              Total: <strong>{data.total.toLocaleString("es-CR")}</strong> usuarios biométricos
            </p>
            <div className="overflow-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">USERID</th>
                    <th className="px-3 py-2 text-left font-medium">Badgenumber</th>
                    <th className="px-3 py-2 text-left font-medium">Nombre</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.slice(0, 100).map((row) => (
                    <tr key={row.attUserId} className="border-t">
                      <td className="px-3 py-2 font-mono">{row.attUserId}</td>
                      <td className="px-3 py-2 font-mono">{row.badgeNumber}</td>
                      <td className="px-3 py-2">{row.name ?? "—"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={row.attEnabled ? "default" : "secondary"}>
                          {row.attEnabled ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
                        Sin usuarios en USERINFO.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {data.total > 100 ? (
              <p className="mt-2 text-xs text-slate-500">
                Mostrando los primeros 100 de {data.total.toLocaleString("es-CR")} registros.
              </p>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
