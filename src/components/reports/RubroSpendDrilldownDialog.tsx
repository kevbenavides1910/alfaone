"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/format";
import { ExternalLink, Loader2 } from "lucide-react";

export type RubroSpendDrilldownRubro = "LABOR" | "SUPPLIES" | "ADMIN" | "PROFIT";

export interface RubroSpendDrilldownTarget {
  /** Contrato individual (modo ficha / fila del reporte). */
  contractId?: string;
  /** Varios contratos — fila TOTALES del reporte mensual. */
  consolidated?: boolean;
  contractIds?: string[];
  licitacionNo: string;
  client: string;
  month: string;
  rubro: RubroSpendDrilldownRubro;
}

type BreakdownLine = {
  id: string;
  group: string;
  label: string;
  detail: string | null;
  amount: number;
  href: string | null;
};

type LaborEmployeeContrato = {
  contractId: string | null;
  licitacionNo: string | null;
  client: string | null;
  noContrato: string;
  marcas: number;
  horas: number;
  pagoRol: number;
  participacion: number;
  devengado: number;
  cargasSocialesMonto: number;
  brutoConCargasSociales: number;
};

type LaborEmployee = {
  sourceKey: string;
  noEmple: string;
  nombre: string | null;
  codPla: string;
  nominaNombre: string | null;
  devengado: number;
  cargasSocialesMonto: number;
  brutoConCargasSociales: number;
  contratos: LaborEmployeeContrato[];
};

type BreakdownResponse = {
  contractId?: string;
  consolidated?: boolean;
  contractCount?: number;
  licitacionNo?: string;
  client?: string;
  month: string;
  rubro: RubroSpendDrilldownRubro;
  rubroLabel: string;
  total: number;
  laborSource: "naf" | "manual" | null;
  items: BreakdownLine[];
  laborEmployees?: LaborEmployee[];
};

const MONTH_NAMES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

function contratoLabel(row: LaborEmployeeContrato): string {
  return row.licitacionNo ?? row.client ?? row.noContrato;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: RubroSpendDrilldownTarget | null;
}

const LABOR_TABLE_TH_CLASS =
  "sticky top-0 z-10 bg-slate-50 align-top border-b border-slate-200 shadow-[0_1px_0_0_rgb(226,232,240)] text-[10px] text-slate-500 uppercase tracking-wide px-3 py-1.5 font-semibold";

function LaborEmployeesBreakdown({
  employees,
  contractId,
  consolidated,
}: {
  employees: LaborEmployee[];
  contractId?: string;
  consolidated?: boolean;
}) {
  if (consolidated) {
    return (
      <div className="rounded-lg border bg-card">
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className={`${LABOR_TABLE_TH_CLASS} text-left`}>Empleado</th>
              <th className={`${LABOR_TABLE_TH_CLASS} text-right w-32`}>Bruto + cargas</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.sourceKey} className="border-b last:border-0 hover:bg-muted/30">
                <td className="px-3 py-2 text-slate-800">
                  <div className="font-medium">{emp.nombre?.trim() || `Empleado ${emp.noEmple}`}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {emp.noEmple}
                    {emp.codPla ? ` · Planilla ${emp.codPla}` : ""}
                    {emp.nominaNombre ? ` · ${emp.nominaNombre}` : ""}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                  {formatCurrency(emp.brutoConCargasSociales)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className={`${LABOR_TABLE_TH_CLASS} text-left`}>Contrato</th>
            <th className={`${LABOR_TABLE_TH_CLASS} text-right w-16`}>Horas</th>
            <th className={`${LABOR_TABLE_TH_CLASS} text-right w-12`}>%</th>
            <th className={`${LABOR_TABLE_TH_CLASS} text-right w-28`}>Bruto + cargas</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp) => {
            const onThisContract =
              contractId != null
                ? emp.contratos.find((c) => c.contractId === contractId)?.brutoConCargasSociales ?? 0
                : 0;
            return (
              <EmployeeLaborRows
                key={emp.sourceKey}
                emp={emp}
                contractId={contractId ?? ""}
                onThisContract={onThisContract}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmployeeLaborRows({
  emp,
  contractId,
  onThisContract,
}: {
  emp: LaborEmployee;
  contractId: string;
  onThisContract: number;
}) {
  return (
    <>
      <tr className="bg-muted/40 border-t border-slate-200">
        <td colSpan={2} className="px-3 py-2.5">
          <div className="font-semibold text-slate-900">{emp.nombre?.trim() || `Empleado ${emp.noEmple}`}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">
            {emp.noEmple}
            {emp.codPla ? ` · Planilla ${emp.codPla}` : ""}
            {emp.nominaNombre ? ` · ${emp.nominaNombre}` : ""}
          </div>
        </td>
        <td className="px-3 py-2.5 text-right align-top">
          <div className="text-[10px] text-slate-500 uppercase tracking-wide whitespace-nowrap">En este contrato</div>
        </td>
        <td className="px-3 py-2.5 text-right align-top">
          <div className="font-bold text-blue-800 tabular-nums whitespace-nowrap">{formatCurrency(onThisContract)}</div>
          {emp.contratos.length > 1 ? (
            <div className="text-[10px] text-slate-500 mt-0.5 whitespace-nowrap">
              Total mes: {formatCurrency(emp.brutoConCargasSociales)}
            </div>
          ) : null}
        </td>
      </tr>
      {emp.contratos.map((row) => {
        const isCurrent = row.contractId === contractId;
        const key = row.contractId ?? row.noContrato;
        return (
          <tr
            key={key}
            className={`border-b border-slate-100 ${isCurrent ? "bg-blue-50/80" : "hover:bg-muted/20"}`}
          >
            <td className="px-3 py-2 text-slate-800">
              <div className={`font-medium ${isCurrent ? "text-blue-900" : ""}`}>
                {contratoLabel(row)}
                {isCurrent ? (
                  <span className="ml-1.5 text-[10px] font-semibold text-blue-700">(este contrato)</span>
                ) : null}
              </div>
              {row.client && row.licitacionNo ? (
                <div className="text-[10px] text-slate-500">{row.client}</div>
              ) : null}
              {!row.contractId ? (
                <div className="text-[10px] text-amber-700">Sin vincular al sistema</div>
              ) : null}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-600">
              {row.horas > 0 ? row.horas : "—"}
            </td>
            <td className="px-3 py-2 text-right tabular-nums text-slate-600">
              {(row.participacion * 100).toFixed(0)}%
            </td>
            <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
              {formatCurrency(row.brutoConCargasSociales)}
            </td>
          </tr>
        );
      })}
      <tr className="bg-muted/30 font-semibold border-b border-slate-200">
        <td className="px-3 py-2 text-right" colSpan={3}>
          Total empleado (mes)
        </td>
        <td className="px-3 py-2 text-right tabular-nums">
          {formatCurrency(emp.brutoConCargasSociales)}
        </td>
      </tr>
    </>
  );
}

export function RubroSpendDrilldownDialog({ open, onOpenChange, target }: Props) {
  const isConsolidated = !!target?.consolidated;
  const contractIds = target?.contractIds ?? [];

  const { data, isLoading, isError } = useQuery<{ data: BreakdownResponse }>({
    queryKey: [
      "rubro-spend-breakdown",
      isConsolidated ? "consolidated" : target?.contractId,
      target?.month,
      target?.rubro,
      isConsolidated ? contractIds.join(",") : null,
    ],
    queryFn: () => {
      const sp = new URLSearchParams({
        month: target!.month,
        rubro: target!.rubro,
      });
      if (isConsolidated) {
        for (const id of contractIds) sp.append("contractId", id);
        return fetch(`/api/reports/rubro-breakdown?${sp}`).then((r) => {
          if (!r.ok) throw new Error(String(r.status));
          return r.json();
        });
      }
      return fetch(`/api/contracts/${target!.contractId}/rubro-breakdown?${sp}`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      });
    },
    enabled:
      open &&
      !!target?.month &&
      !!target?.rubro &&
      (isConsolidated ? contractIds.length > 0 : !!target?.contractId),
  });

  const payload = data?.data;
  const [year, monthNum] = (target?.month ?? "").split("-").map(Number);
  const titleMonth =
    year && monthNum ? `${MONTH_NAMES[monthNum - 1]} ${year}` : target?.month;

  const grouped = payload
    ? payload.items.reduce<Record<string, BreakdownLine[]>>((acc, item) => {
        const list = acc[item.group] ?? [];
        list.push(item);
        acc[item.group] = list;
        return acc;
      }, {})
    : {};

  const showLaborEmployees =
    payload?.rubro === "LABOR" &&
    payload?.laborSource === "naf" &&
    payload.laborEmployees &&
    payload.laborEmployees.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg">
            {target ? (
              <>
                {payload?.rubroLabel ?? target.rubro} · {target.licitacionNo}
              </>
            ) : (
              "Desglose de gasto"
            )}
          </DialogTitle>
          <DialogDescription className="text-left text-slate-600">
            {target?.client}
            {isConsolidated && payload?.contractCount != null ? (
              <span className="block text-xs text-slate-500 mt-1">
                {payload.contractCount} contrato{payload.contractCount === 1 ? "" : "s"} incluidos en el total
              </span>
            ) : null}
            <span className="block text-xs text-slate-500 mt-1">
              {titleMonth}
              {payload?.laborSource === "naf"
                ? target?.rubro === "ADMIN"
                  ? isConsolidated
                    ? " · Nómina NAF administrativa consolidada (bruto + cargas)"
                    : " · Nómina NAF de personal administrativo (bruto + cargas) imputada a este rubro"
                  : isConsolidated
                    ? " · Nómina NAF consolidada: total del mes por empleado en los contratos del reporte"
                    : " · Nómina NAF: salario repartido por horas y precio del rol en cada contrato"
                : null}
              {payload?.laborSource === "manual" ? " · Fuente: gastos registrados" : null}
            </span>
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando desglose…
          </div>
        )}

        {isError && (
          <p className="text-sm text-red-600 py-4">No se pudo cargar el detalle del gasto.</p>
        )}

        {payload && !isLoading && (
          <div className="space-y-4 text-sm">
            <section className="rounded-lg border bg-muted/50 p-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">Total del rubro</p>
                <p className="text-xl font-bold text-slate-900">{formatCurrency(payload.total)}</p>
                {payload.rubro === "LABOR" &&
                  payload.laborEmployees &&
                  payload.laborEmployees.length > 0 && (
                    <p className="text-xs text-amber-700 mt-1 font-medium">
                      Cargas sociales:{" "}
                      {formatCurrency(
                        payload.laborEmployees.reduce(
                          (sum, emp) => sum + (emp.cargasSocialesMonto ?? 0),
                          0,
                        ),
                      )}
                    </p>
                  )}
                <p className="text-xs text-slate-500 mt-1">
                  {showLaborEmployees
                    ? `${payload.laborEmployees!.length} empleado${payload.laborEmployees!.length === 1 ? "" : "s"}`
                    : `${payload.items.length} registro${payload.items.length === 1 ? "" : "s"}`}
                </p>
              </div>
            </section>

            {showLaborEmployees && target ? (
              <LaborEmployeesBreakdown
                employees={payload.laborEmployees!}
                contractId={target.contractId}
                consolidated={isConsolidated}
              />
            ) : payload.items.length === 0 ? (
              <p className="text-slate-500 text-sm py-4 text-center">
                No hay movimientos registrados para este rubro en el mes.
              </p>
            ) : (
              <div className="space-y-4">
                {Object.entries(grouped).map(([group, lines]) => (
                  <section key={group} className="rounded-lg border overflow-hidden">
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide px-3 py-2 bg-muted/40 border-b">
                      {group}
                    </h4>
                    <table className="w-full text-xs">
                      <tbody>
                        {lines.map((line) => (
                          <tr key={line.id} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="px-3 py-2 text-slate-800">
                              <div className="font-medium">{line.label}</div>
                              {line.detail ? (
                                <div className="text-[10px] text-slate-500 mt-0.5">{line.detail}</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums whitespace-nowrap">
                              {formatCurrency(line.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </section>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              {payload.laborSource === "naf" && (
                <Button variant="outline" className="flex-1 gap-2" asChild>
                  <Link href="/empleados-naf/nomina">
                    Ver nómina NAF
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {target && !isConsolidated && target.contractId && (
                <Button variant="outline" className="flex-1 gap-2" asChild>
                  <Link href={`/contracts/${target.contractId}`}>
                    Ficha del contrato
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              )}
              {(payload.rubro === "SUPPLIES" || payload.rubro === "ADMIN") && (
                <Button variant="outline" className="flex-1 gap-2" asChild>
                  <Link href="/expenses">
                    Módulo de gastos
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
