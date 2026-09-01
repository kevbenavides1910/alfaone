"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FingerCompanyFilterHint } from "@/components/finger-system/FingerCompanyFilterHint";
import { fingerApiUrl, useFingerCompany } from "@/components/finger-system/finger-company-context";
import {
  ATTENDANCE_STATUS_LABEL,
  ATTENDANCE_STATUS_TONE,
  formatMinutes,
} from "@/modules/finger-system/config/finger-attendance.client";
import type { FingerAttendanceDayRow } from "@/modules/finger-system/services/finger-attendance-calc";

type ListResponse = {
  items: FingerAttendanceDayRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FingerAttendancePanel() {
  const queryClient = useQueryClient();
  const { companyCode } = useFingerCompany();
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setPage(1);
    setLoaded(false);
  }, [companyCode]);

  const listQuery = useQuery<{ data: ListResponse }>({
    queryKey: ["finger-attendance-daily", from, to, q, page, companyCode],
    queryFn: async () => {
      const qs = new URLSearchParams({ from, to, page: String(page), pageSize: "25" });
      if (q.trim()) qs.set("q", q.trim());
      const res = await fetch(fingerApiUrl(`/api/finger-system/attendance/daily?${qs}`, companyCode), {
        credentials: "same-origin",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al listar");
      return json;
    },
    enabled: loaded,
  });

  const calcMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/finger-system/attendance/calculate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to,
          ...(companyCode ? { company: companyCode } : {}),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al calcular");
      return json.data;
    },
    onSuccess: () => {
      setLoaded(true);
      queryClient.invalidateQueries({ queryKey: ["finger-attendance-daily"] });
      queryClient.invalidateQueries({ queryKey: ["finger-system-dashboard"] });
    },
  });

  const data = listQuery.data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cálculo de asistencia</CardTitle>
        <p className="text-sm text-slate-500">
          Agrupa marcas importadas por día (primera entrada / última salida) y compara con el turno
          default.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
          <div className="space-y-2">
            <Label htmlFor="att-from">Desde</Label>
            <Input id="att-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="att-to">Hasta</Label>
            <Input id="att-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Button onClick={() => calcMutation.mutate()} disabled={calcMutation.isPending}>
            {calcMutation.isPending ? "Calculando…" : "Calcular asistencia"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setLoaded(true);
              listQuery.refetch();
            }}
            disabled={listQuery.isFetching}
          >
            {listQuery.isFetching ? "Cargando…" : "Ver resultados"}
          </Button>
          <FingerCompanyFilterHint />
        </div>

        {calcMutation.isSuccess ? (
          <p className="text-sm text-emerald-700">
            Calculados {calcMutation.data.rowsUpserted} registros para{" "}
            {calcMutation.data.employeeCount} empleados.
          </p>
        ) : null}
        {calcMutation.isError ? (
          <p className="text-sm text-red-600">{(calcMutation.error as Error).message}</p>
        ) : null}

        <Input
          placeholder="Buscar empleado…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
            setLoaded(true);
          }}
          className="max-w-sm"
        />

        {listQuery.isError ? (
          <p className="text-sm text-red-600">{(listQuery.error as Error).message}</p>
        ) : null}

        {data ? (
          <>
            <p className="text-sm text-slate-500">{data.total} registro{data.total === 1 ? "" : "s"}</p>
            <div className="overflow-auto rounded-lg border max-h-96">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Fecha</th>
                    <th className="px-3 py-2 text-left font-medium">Empleado</th>
                    <th className="px-3 py-2 text-left font-medium">Entrada</th>
                    <th className="px-3 py-2 text-left font-medium">Salida</th>
                    <th className="px-3 py-2 text-left font-medium">Trabajado</th>
                    <th className="px-3 py-2 text-left font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{row.workDate}</td>
                      <td className="px-3 py-2">
                        <div>{row.employeeName ?? "—"}</div>
                        <div className="text-xs text-slate-500">{row.employeeCodigo}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.firstIn ? new Date(row.firstIn).toLocaleTimeString("es-CR") : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {row.lastOut ? new Date(row.lastOut).toLocaleTimeString("es-CR") : "—"}
                      </td>
                      <td className="px-3 py-2">{formatMinutes(row.workedMinutes)}</td>
                      <td className="px-3 py-2">
                        <Badge className={ATTENDANCE_STATUS_TONE[row.status]}>
                          {ATTENDANCE_STATUS_LABEL[row.status]}
                        </Badge>
                        {row.lateMinutes > 0 ? (
                          <span className="block text-xs text-orange-600">+{row.lateMinutes}m tarde</span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {data.items.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        Sin resultados. Importe marcas y calcule asistencia.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 ? (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <span className="text-sm text-slate-600">
                  Página {data.page} de {data.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= data.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Siguiente
                </Button>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
