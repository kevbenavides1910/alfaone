"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FingerCompanyFilterHint } from "@/components/finger-system/FingerCompanyFilterHint";
import { fingerApiUrl, useFingerCompany } from "@/components/finger-system/finger-company-context";
import {
  ATTENDANCE_STATUS_LABEL,
  type FingerAttendanceStatusKey,
} from "@/modules/finger-system/config/finger-attendance.client";

type ReportSummary = {
  from: string;
  to: string;
  company: string | null;
  totalRecords: number;
  linkedEmployees: number;
  totals: Record<FingerAttendanceStatusKey, number>;
  byDate: {
    date: string;
    present: number;
    absent: number;
    late: number;
    incomplete: number;
    earlyLeave: number;
  }[];
};

function firstDayOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function FingerReportsPanel() {
  const { companyCode } = useFingerCompany();
  const [from, setFrom] = useState(firstDayOfMonth());
  const [to, setTo] = useState(todayIso());
  const [run, setRun] = useState(false);

  useEffect(() => {
    setRun(false);
  }, [companyCode]);

  const reportQuery = useQuery<{ data: ReportSummary }>({
    queryKey: ["finger-report-attendance", from, to, companyCode],
    queryFn: async () => {
      const qs = new URLSearchParams({ from, to });
      const res = await fetch(
        fingerApiUrl(`/api/finger-system/reports/attendance?${qs}`, companyCode),
        { credentials: "same-origin" },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message ?? "Error al generar reporte");
      return json;
    },
    enabled: run && Boolean(from && to),
  });

  const report = reportQuery.data?.data;

  const exportCsv = () => {
    const qs = new URLSearchParams({ from, to });
    window.open(fingerApiUrl(`/api/finger-system/reports/attendance/export?${qs}`, companyCode), "_blank");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reporte de asistencia</CardTitle>
          <p className="text-sm text-slate-500">
            Resumen de incidencias calculadas. Exporte CSV para Planillas (Excel compatible).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
            <div className="space-y-2">
              <Label htmlFor="rep-from">Desde</Label>
              <Input id="rep-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rep-to">Hasta</Label>
              <Input id="rep-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <Button
              onClick={() => {
                setRun(true);
                reportQuery.refetch();
              }}
              disabled={reportQuery.isFetching}
            >
              {reportQuery.isFetching ? "Generando…" : "Generar reporte"}
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={!from || !to}>
              Exportar CSV
            </Button>
            <FingerCompanyFilterHint />
          </div>

          {reportQuery.isError ? (
            <p className="text-sm text-red-600">{(reportQuery.error as Error).message}</p>
          ) : null}

          {report ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                {(Object.keys(ATTENDANCE_STATUS_LABEL) as FingerAttendanceStatusKey[]).map((key) => (
                  <MiniStat
                    key={key}
                    label={ATTENDANCE_STATUS_LABEL[key]}
                    value={report.totals[key] ?? 0}
                  />
                ))}
              </div>
              <p className="text-sm text-slate-600">
                {report.totalRecords} registros · {report.linkedEmployees} empleados vinculados
                {report.company ? ` · empresa ${report.company}` : ""}
              </p>
              {report.byDate.length > 0 ? (
                <div className="overflow-auto rounded-lg border max-h-64">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left">Fecha</th>
                        <th className="px-3 py-2 text-left">Presente</th>
                        <th className="px-3 py-2 text-left">Ausente</th>
                        <th className="px-3 py-2 text-left">Tardía</th>
                        <th className="px-3 py-2 text-left">Incompleto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byDate.map((d) => (
                        <tr key={d.date} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs">{d.date}</td>
                          <td className="px-3 py-2">{d.present + d.earlyLeave}</td>
                          <td className="px-3 py-2">{d.absent}</td>
                          <td className="px-3 py-2">{d.late}</td>
                          <td className="px-3 py-2">{d.incomplete}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-amber-700">
                  Sin datos calculados en el rango. Ejecute «Calcular asistencia» en la sección Asistencia primero.
                </p>
              )}
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
