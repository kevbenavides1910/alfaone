"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useRef, useCallback } from "react";
import { useSession } from "@/lib/auth/client-session";
import Link from "next/link";
import { Plus, Search, Upload, Download, FileSpreadsheet, CalendarDays, X } from "lucide-react";
import { toast } from "@/components/ui/toaster";
import { Topbar } from "@/components/layout/Topbar";
import { ContractsPageHeader } from "@/components/contracts/ContractsPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Badge } from "@/components/ui/badge";
import { TrafficLightBadge } from "@/components/shared/TrafficLightBadge";
import { formatCurrency, formatDate, daysUntilExpiry } from "@/lib/utils/format";
import { companyDisplayName, CONTRACT_STATUS_LABELS, CLIENT_TYPE_LABELS, HIRING_TYPE_LABELS } from "@/lib/utils/constants";
import { useCompanies } from "@/lib/hooks/use-companies";
import { canModifyContracts } from "@/modules/core/permissions";
import { periodViewKind } from "@/modules/presupuestos/business/contractPeriodBilling";
import type { ContractStatus, ClientType, ContractHiringType } from "@prisma/client";
import {
  TableColumnFilterHead,
  hasActiveColumnFilters,
  clearColumnFilters,
  type TableColumnFilterDef,
} from "@/components/ui/table-column-filters";
import { filterRowsByColumnFilters } from "@/lib/table/column-filters";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const PERIOD_VIEW_LABELS = {
  past: "Histórico",
  current: "Mes actual",
  future: "Proyección",
} as const;

const PERIOD_VIEW_HINTS = {
  past: "Montos según la tarifa vigente en ese mes (historial de precios y montos por demanda).",
  current: "Facturación del mes en curso según tarifas y montos definidos.",
  future: "Proyección con tarifas vigentes; contratos por demanda aparecen pendientes hasta definir el monto.",
} as const;

interface Contract {
  id: string; licitacionNo: string; company: string; client: string;
  clientType: ClientType; hiringType: ContractHiringType;
  officersCount: number; positionsCount: number;
  status: ContractStatus; startDate: string; endDate: string;
  monthlyBilling: number | null;
  amountDefined?: boolean;
  suppliesBudgetPct: number;
  suppliesBudget: number | null;
  laborPct: number; adminPct: number; profitPct: number;
  laborBudget: number | null; adminBudget: number | null; profitBudget: number | null;
  equivalencePct: number;
  billingSharePct: number; laborSharePct: number; suppliesSharePct: number;
  adminSharePct: number; profitSharePct: number;
  laborSpend?: number;
  suppliesSpend?: number;
  adminSpend?: number;
  profitSpend?: number;
  periodGrandTotal?: number;
}

type PeriodTotals = {
  contractCount: number;
  contractsWithAmount: number;
  billing: number;
  specialServicesTotal: number;
  budgets: {
    labor: number;
    supplies: number;
    admin: number;
    profit: number;
    combined: number;
  };
  spend: {
    labor: number;
    supplies: number;
    admin: number;
    profit: number;
    grandTotal: number;
  };
  expensesByType: Record<string, number>;
};

const EXPENSE_TYPE_LABELS: Record<string, string> = {
  UNIFORMS: "Uniformes",
  AUDIT: "Auditoría",
  DEFERRED_LEGACY: "Diferidos (dist.)",
  ADMIN: "Administrativo",
  TRANSPORT: "Transporte",
  FUEL: "Combustible",
  PHONES: "Teléfonos",
  PLANILLA: "Planilla",
  APERTURA: "Apertura",
  OTHER: "Otros",
};

function expenseTypeLabel(type: string): string {
  return EXPENSE_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function spendUsagePct(spend: number, budget: number): string {
  if (budget <= 0) return spend > 0 ? "—" : "0%";
  return `${((spend / budget) * 100).toFixed(0)}%`;
}

function BudgetPartidaCell({
  amount,
  pct,
  amountDefined = true,
}: {
  amount: number | null;
  pct: number;
  amountDefined?: boolean;
}) {
  if (!amountDefined || amount == null) {
    return (
      <td className="text-right whitespace-nowrap text-[#8d8d8d] italic text-xs">
        Pendiente
      </td>
    );
  }
  return (
    <td className="text-right whitespace-nowrap">
      <div className="font-medium tabular-nums">{formatCurrency(amount)}</div>
      <div className="text-xs text-[#525252] tabular-nums">{(pct * 100).toFixed(1)}%</div>
    </td>
  );
}

function GlobalPartidaCell({ sharePct, active }: { sharePct: number; active: boolean }) {
  if (!active) {
    return <td className="text-right text-[#c6c6c6]">—</td>;
  }
  return (
    <td className="text-right whitespace-nowrap">
      <span className="font-semibold text-red-600 tabular-nums">{(sharePct * 100).toFixed(2)}%</span>
    </td>
  );
}

export default function ContractsPage() {
  const qc = useQueryClient();
  const { data: session } = useSession();
  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];
  const canCreate = canModifyContracts(session ?? null);
  const contractFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [search, setSearch] = useState("");
  const [companies, setCompanies] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("all");
  const [clientType, setClientType] = useState<string>("all");
  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());

  const yearOptions = useMemo(() => {
    const y = new Date().getFullYear();
    return Array.from({ length: 5 }, (_, i) => y - 2 + i);
  }, []);

  const viewKind = periodViewKind(periodYear, periodMonth);
  const monthLabel = MONTHS.find((m) => m.value === periodMonth)?.label ?? "";

  const params = new URLSearchParams();
  if (search) params.set("search", search);
  companies.forEach((c) => params.append("company", c));
  if (status !== "all") params.set("status", status);
  if (clientType !== "all") params.set("clientType", clientType);
  params.set("pageSize", "100");
  params.set("periodYear", String(periodYear));
  params.set("periodMonth", String(periodMonth));

  const { data, isLoading } = useQuery<{ data: Contract[]; meta: { total: number; periodTotals?: PeriodTotals } }>({
    queryKey: ["contracts", search, companies, status, clientType, periodYear, periodMonth],
    queryFn: () => fetch(`/api/contracts?${params}`).then((r) => r.json()),
    staleTime: 30000,
  });

  const contracts = data?.data ?? [];
  const periodTotals = data?.meta?.periodTotals;

  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const onColumnFilterChange = useCallback((key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const contractColumnDefs = useMemo((): TableColumnFilterDef<Contract>[] => {
    const clientTypeOptions = Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => ({
      value: label,
      label,
    }));
    const hiringOptions = Object.entries(HIRING_TYPE_LABELS).map(([value, label]) => ({
      value: label,
      label,
    }));
    const statusOptions = Object.entries(CONTRACT_STATUS_LABELS).map(([value, label]) => ({
      value: label,
      label,
    }));
    return [
      { key: "licitacion", label: "Licitación", getValue: (c) => c.licitacionNo },
      { key: "cliente", label: "Cliente", getValue: (c) => c.client },
      {
        key: "empresa",
        label: "Empresa",
        getValue: (c) => companyDisplayName(c.company, companyRows),
      },
      {
        key: "tipoCliente",
        label: "Tipo cliente",
        getValue: (c) => CLIENT_TYPE_LABELS[c.clientType],
        options: clientTypeOptions,
        mode: "select",
      },
      {
        key: "contratacion",
        label: "Contratación",
        getValue: (c) => HIRING_TYPE_LABELS[c.hiringType ?? "FIXED"],
        options: hiringOptions,
        mode: "select",
      },
      {
        key: "facturacion",
        label: "Facturación",
        align: "right",
        headerClassName: "text-right",
        getValue: (c) =>
          c.amountDefined !== false && c.monthlyBilling != null
            ? formatCurrency(c.monthlyBilling)
            : "Pendiente",
      },
      {
        key: "mo",
        label: "M.O.",
        align: "right",
        headerClassName: "text-right",
        getValue: (c) =>
          c.amountDefined !== false && c.laborBudget != null
            ? formatCurrency(c.laborBudget)
            : "Pendiente",
      },
      {
        key: "insumos",
        label: "Insumos",
        align: "right",
        headerClassName: "text-right",
        getValue: (c) =>
          c.amountDefined !== false && c.suppliesBudget != null
            ? formatCurrency(c.suppliesBudget)
            : "Pendiente",
      },
      {
        key: "adm",
        label: "Adm.",
        align: "right",
        headerClassName: "text-right",
        getValue: (c) =>
          c.amountDefined !== false && c.adminBudget != null
            ? formatCurrency(c.adminBudget)
            : "Pendiente",
      },
      {
        key: "util",
        label: "Util.",
        align: "right",
        headerClassName: "text-right",
        getValue: (c) =>
          c.amountDefined !== false && c.profitBudget != null
            ? formatCurrency(c.profitBudget)
            : "Pendiente",
      },
      { key: "pgFact", label: "P.g. fact.", align: "right", headerClassName: "text-right", getValue: (c) => `${((c.billingSharePct ?? 0) * 100).toFixed(2)}%` },
      { key: "pgMo", label: "P.g. M.O.", align: "right", headerClassName: "text-right", getValue: (c) => `${((c.laborSharePct ?? 0) * 100).toFixed(2)}%` },
      { key: "pgIns", label: "P.g. ins.", align: "right", headerClassName: "text-right", getValue: (c) => `${((c.suppliesSharePct ?? 0) * 100).toFixed(2)}%` },
      { key: "pgAdm", label: "P.g. adm.", align: "right", headerClassName: "text-right", getValue: (c) => `${((c.adminSharePct ?? 0) * 100).toFixed(2)}%` },
      { key: "pgUtil", label: "P.g. util.", align: "right", headerClassName: "text-right", getValue: (c) => `${((c.profitSharePct ?? 0) * 100).toFixed(2)}%` },
      { key: "ejecucion", label: "Ejecución", getValue: () => "Verde" },
      { key: "vencimiento", label: "Vencimiento", getValue: (c) => formatDate(c.endDate) },
      {
        key: "estado",
        label: "Estado",
        getValue: (c) => CONTRACT_STATUS_LABELS[c.status],
        options: statusOptions,
        mode: "select",
      },
      { key: "actions", label: "", filterable: false, getValue: () => "" },
    ];
  }, [companyRows]);

  const displayedContracts = useMemo(
    () =>
      filterRowsByColumnFilters(
        contracts,
        columnFilters,
        contractColumnDefs.map((col) => ({
          key: col.key,
          getValue: col.getValue,
          mode: col.mode,
          filterable: col.filterable,
        }))
      ),
    [contracts, columnFilters, contractColumnDefs]
  );

  const columnFilterKeys = useMemo(
    () => contractColumnDefs.filter((c) => c.filterable !== false).map((c) => c.key),
    [contractColumnDefs]
  );

  async function downloadContractsExport() {
    const sp = new URLSearchParams();
    if (search) sp.set("search", search);
    companies.forEach((c) => sp.append("company", c));
    if (status !== "all") sp.set("status", status);
    if (clientType !== "all") sp.set("clientType", clientType);
    sp.set("periodYear", String(periodYear));
    sp.set("periodMonth", String(periodMonth));
    const res = await fetch(`/api/contracts/export?${sp.toString()}`, { credentials: "same-origin" });
    if (!res.ok) {
      toast.error("No se pudo exportar a Excel");
      return;
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition");
    const m = cd?.match(/filename="([^"]+)"/);
    const filename = m?.[1] ?? "contratos.xlsx";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Descarga de contratos lista");
  }

  async function downloadContractTemplate() {
    const res = await fetch("/api/import/contracts", { credentials: "same-origin" });
    if (!res.ok) {
      toast.error("No se pudo descargar la plantilla");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "plantilla_importar_contratos.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onContractFileSelected(f: File | null) {
    if (!f) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.set("file", f);
      const res = await fetch("/api/import/contracts", { method: "POST", body: fd, credentials: "same-origin" });
      const json = (await res.json()) as {
        data?: {
          created?: number;
          skipped?: number;
          skippedExistingRows?: { sheetRow: number; licitacionNo: string }[];
          errors?: { sheetRow: number; message: string }[];
          message?: string;
        };
        error?: { message?: string };
      };
      if (!res.ok) {
        toast.error(json.error?.message ?? "Error al importar");
        return;
      }
      const d = json.data;
      const createdN = d?.created ?? 0;
      const blockingErrors = d?.errors ?? [];
      const skippedRows = d?.skippedExistingRows ?? [];

      const errLines =
        blockingErrors.length > 0
          ? blockingErrors
              .slice(0, 100)
              .map((e) => `Fila ${e.sheetRow}: ${e.message}`)
              .join("\n") + (blockingErrors.length > 100 ? `\n… y ${blockingErrors.length - 100} más.` : "")
          : "";

      const skippedLines =
        skippedRows.length > 0
          ? skippedRows.length <= 40
            ? skippedRows.map((s) => `Fila ${s.sheetRow}: ${s.licitacionNo}`).join("\n")
            : `${skippedRows
                .slice(0, 35)
                .map((s) => `Fila ${s.sheetRow}: ${s.licitacionNo}`)
                .join("\n")}\n… y ${skippedRows.length - 35} más (total ${skippedRows.length} omitidas).`
          : "";

      const errHint =
        errLines !== "" || skippedLines !== ""
          ? `\n\n— «Fila N» = fila en Excel (fila 1 = títulos). «Omitidas» no son fallo: esa licitación ya está guardada.`
          : "";

      const detailParts: string[] = [];
      if (errLines) detailParts.push(`ERRORES — corrija en el archivo:\n${errLines}`);
      if (skippedLines) detailParts.push(`OMITIDAS — ya existen en el sistema:\n${skippedLines}`);
      const detailBody = detailParts.length > 0 ? `${detailParts.join("\n\n")}${errHint}` : "";

      const longDetail = detailBody.length > 200;
      const toastOpts = longDetail ? { durationMs: 90_000, copyable: true as const } : undefined;

      if (createdN > 0) {
        toast.success(d?.message ?? `Se importaron ${createdN} contrato(s).`, detailBody || undefined, toastOpts);
      } else if (errLines) {
        toast.error("No se importaron contratos nuevos", detailBody || d?.message, toastOpts);
      } else if (skippedLines) {
        toast.info("Importación", detailBody || d?.message || "Sin contratos nuevos.", toastOpts);
      } else {
        toast.info("Importación", d?.message ?? "Sin filas nuevas.");
      }
      qc.invalidateQueries({ queryKey: ["contracts"] });
    } finally {
      setImporting(false);
      if (contractFileRef.current) contractFileRef.current.value = "";
    }
  }

  const statusColors: Record<ContractStatus, string> = {
    ACTIVE: "success", PROLONGATION: "warning", SUSPENDED: "warning",
    FINISHED: "secondary", CANCELLED: "destructive",
  };

  return (
    <>
      <Topbar title="Contratos" />
      <ContractsPageHeader
        title="Gestión de contratos"
        description={`${data?.meta.total ?? 0} contratos en vigencia en ${monthLabel} ${periodYear} · ${PERIOD_VIEW_LABELS[viewKind]}. ${PERIOD_VIEW_HINTS[viewKind]}`}
        actions={
          <>
            {session && (
              <Button
                type="button"
                variant="outline"
                className="gap-2 rounded-sm border-[#c6c6c6] bg-white shadow-none hover:bg-[#e8e8e8]"
                onClick={downloadContractsExport}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
            )}
            {canCreate && (
              <>
                <input
                  ref={contractFileRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => onContractFileSelected(e.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-sm border-[#c6c6c6] bg-white shadow-none hover:bg-[#e8e8e8]"
                  onClick={downloadContractTemplate}
                >
                  <Download className="h-4 w-4" />
                  Plantilla
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 rounded-sm border-[#c6c6c6] bg-white shadow-none hover:bg-[#e8e8e8]"
                  disabled={importing}
                  onClick={() => contractFileRef.current?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {importing ? "Importando…" : "Importar"}
                </Button>
                <Link href="/contracts/new">
                  <Button className="gap-2 rounded-sm bg-red-600 hover:bg-red-700 shadow-none">
                    <Plus className="h-4 w-4" />
                    Nuevo contrato
                  </Button>
                </Link>
              </>
            )}
          </>
        }
      />

      <div className="carbon-toolbar">
        <div className="flex flex-wrap gap-3">
          <CalendarDays className="hidden h-5 w-5 shrink-0 self-center text-[#525252] sm:block" />
          <Select
            value={String(periodMonth)}
            onValueChange={(v) => setPeriodMonth(parseInt(v, 10))}
          >
            <SelectTrigger className="w-[160px] rounded-sm border-[#c6c6c6] bg-[#f4f4f4] shadow-none">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m.value} value={String(m.value)}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(periodYear)} onValueChange={(v) => setPeriodYear(parseInt(v, 10))}>
            <SelectTrigger className="w-[120px] rounded-sm border-[#c6c6c6] bg-[#f4f4f4] shadow-none">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge
            variant={viewKind === "current" ? "default" : "outline"}
            className="self-center rounded-sm font-normal"
          >
            {PERIOD_VIEW_LABELS[viewKind]}
          </Badge>
          <div className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#525252]" />
            <Input
              placeholder="Buscar por licitación o cliente…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="rounded-sm border-[#c6c6c6] bg-[#f4f4f4] pl-9 shadow-none focus-visible:ring-red-500"
            />
          </div>
          <MultiSelect
            options={companyRows.map((c) => ({ value: c.code, label: c.name }))}
            value={companies}
            onChange={setCompanies}
            placeholder="Todas las empresas"
            className="w-52"
          />
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-40 rounded-sm border-[#c6c6c6] bg-[#f4f4f4] shadow-none">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(CONTRACT_STATUS_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientType} onValueChange={setClientType}>
            <SelectTrigger className="w-40 rounded-sm border-[#c6c6c6] bg-[#f4f4f4] shadow-none">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {Object.entries(CLIENT_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="carbon-panel mx-4 mb-8 md:mx-6 border-x-0 border-t-0">
        {isLoading ? (
          <div className="carbon-empty">Cargando contratos…</div>
        ) : displayedContracts.length === 0 ? (
              <div className="carbon-empty">
                No se encontraron contratos en vigencia para {monthLabel} {periodYear} con los filtros aplicados.
              </div>
        ) : (
          <div className="carbon-table-viewport">
            {hasActiveColumnFilters(columnFilters) && (
              <div className="flex justify-end px-3 py-1.5 border-b border-[#e0e0e0] bg-[#f4f4f4]">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setColumnFilters(clearColumnFilters(columnFilterKeys))}
                >
                  <X className="h-3 w-3" />
                  Limpiar filtros de columnas
                </Button>
              </div>
            )}
            <table data-table-id="contracts-listado" className="carbon-data-table">
              <thead>
                <TableColumnFilterHead
                  tableId="contracts-listado"
                  columns={contractColumnDefs}
                  rows={contracts}
                  filters={columnFilters}
                  onFilterChange={onColumnFilterChange}
                  filterRowClassName="bg-[#f4f4f4] border-b border-[#e0e0e0]"
                  defaultColumnWidths={{
                    licitacion: 120,
                    cliente: 200,
                    empresa: 140,
                    tipoCliente: 100,
                    contratacion: 110,
                    facturacion: 110,
                    mo: 90,
                    insumos: 90,
                    adm: 90,
                    util: 90,
                    pgFact: 80,
                    pgMo: 80,
                    pgIns: 80,
                    pgAdm: 80,
                    pgUtil: 80,
                    ejecucion: 90,
                    vencimiento: 110,
                    estado: 100,
                    actions: 80,
                  }}
                />
              </thead>
              <tbody>
                {displayedContracts.map((c) => {
                  const days = daysUntilExpiry(c.endDate);
                  const expireWarning = days >= 0 && days <= 30;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link href={`/contracts/${c.id}`} className="carbon-link">
                          {c.licitacionNo}
                        </Link>
                      </td>
                      <td className="max-w-48">
                        <div className="truncate font-medium">{c.client}</div>
                        <div className="text-xs text-[#525252]">{c.officersCount} oficiales · {c.positionsCount} puestos</div>
                      </td>
                      <td>
                        <Badge variant="outline" className="rounded-sm border-[#c6c6c6] font-normal text-[#161616]">
                          {companyDisplayName(c.company, companyRows)}
                        </Badge>
                      </td>
                      <td className="text-[#525252]">{CLIENT_TYPE_LABELS[c.clientType]}</td>
                      <td>
                        <Badge
                          variant={c.hiringType === "FIXED" ? "secondary" : "outline"}
                          className="rounded-sm font-normal"
                        >
                          {HIRING_TYPE_LABELS[c.hiringType ?? "FIXED"]}
                        </Badge>
                      </td>
                      <td className="text-right font-medium tabular-nums">
                        {c.amountDefined !== false && c.monthlyBilling != null
                          ? formatCurrency(c.monthlyBilling)
                          : <span className="text-[#8d8d8d] italic text-xs font-normal">Pendiente</span>}
                      </td>
                      <BudgetPartidaCell amount={c.laborBudget} pct={c.laborPct ?? 0} amountDefined={c.amountDefined !== false} />
                      <BudgetPartidaCell amount={c.suppliesBudget} pct={c.suppliesBudgetPct ?? 0} amountDefined={c.amountDefined !== false} />
                      <BudgetPartidaCell amount={c.adminBudget} pct={c.adminPct ?? 0} amountDefined={c.amountDefined !== false} />
                      <BudgetPartidaCell amount={c.profitBudget} pct={c.profitPct ?? 0} amountDefined={c.amountDefined !== false} />
                      {(() => {
                        const showGlobal = c.amountDefined !== false;
                        return (
                          <>
                            <GlobalPartidaCell sharePct={c.billingSharePct ?? 0} active={showGlobal} />
                            <GlobalPartidaCell sharePct={c.laborSharePct ?? 0} active={showGlobal} />
                            <GlobalPartidaCell sharePct={c.suppliesSharePct ?? 0} active={showGlobal} />
                            <GlobalPartidaCell sharePct={c.adminSharePct ?? 0} active={showGlobal} />
                            <GlobalPartidaCell sharePct={c.profitSharePct ?? 0} active={showGlobal} />
                          </>
                        );
                      })()}
                      <td className="min-w-32">
                        {(() => {
                          if (c.laborSpend == null) {
                            return <TrafficLightBadge light="GREEN" size="sm" />;
                          }
                          const usages = [
                            c.laborBudget && c.laborBudget > 0 ? (c.laborSpend ?? 0) / c.laborBudget : 0,
                            c.suppliesBudget && c.suppliesBudget > 0 ? (c.suppliesSpend ?? 0) / c.suppliesBudget : 0,
                            c.adminBudget && c.adminBudget > 0 ? (c.adminSpend ?? 0) / c.adminBudget : 0,
                          ];
                          const maxUsage = Math.max(...usages, 0);
                          const light =
                            maxUsage > 1 ? "RED" : maxUsage > 0.85 ? "YELLOW" : "GREEN";
                          return (
                            <div>
                              <TrafficLightBadge light={light as "GREEN" | "YELLOW" | "RED"} size="sm" />
                              <div className="text-[10px] text-[#525252] tabular-nums mt-0.5">
                                {formatCurrency(c.periodGrandTotal ?? 0)}
                              </div>
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        <span className={expireWarning ? "font-medium text-[#da1e28]" : "text-[#525252]"}>
                          {formatDate(c.endDate)}
                        </span>
                        {expireWarning && <div className="text-xs text-[#da1e28]">{days}d restantes</div>}
                      </td>
                      <td>
                        <Badge variant={statusColors[c.status] as never} className="rounded-sm font-normal">
                          {CONTRACT_STATUS_LABELS[c.status]}
                        </Badge>
                      </td>
                      <td>
                        <Link href={`/contracts/${c.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-sm text-red-600 hover:bg-slate-100 hover:text-red-700"
                          >
                            Ver
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-[#f4f4f4] border-t-2 border-[#c6c6c6]">
                {periodTotals ? (
                  <>
                    <tr className="font-semibold">
                      <td colSpan={5} className="py-2">
                        Presupuesto — {periodTotals.contractCount} contratos en vigencia
                        {periodTotals.specialServicesTotal > 0 && (
                          <span className="block text-xs font-normal text-[#525252]">
                            Incluye {formatCurrency(periodTotals.specialServicesTotal)} en servicios especiales
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular-nums py-2">{formatCurrency(periodTotals.billing)}</td>
                      <td className="text-right tabular-nums py-2">{formatCurrency(periodTotals.budgets.labor)}</td>
                      <td className="text-right tabular-nums py-2">{formatCurrency(periodTotals.budgets.supplies)}</td>
                      <td className="text-right tabular-nums py-2">{formatCurrency(periodTotals.budgets.admin)}</td>
                      <td className="text-right tabular-nums py-2">{formatCurrency(periodTotals.budgets.profit)}</td>
                      <td colSpan={6} />
                    </tr>
                    <tr className="font-semibold text-[#161616]">
                      <td colSpan={5} className="py-2">
                        Gasto del mes — todos los contratos
                        <span className="block text-xs font-normal text-[#525252]">
                          Total: {formatCurrency(periodTotals.spend.grandTotal)}
                        </span>
                      </td>
                      <td className="text-right tabular-nums py-2 text-[#525252]">—</td>
                      <td className="text-right tabular-nums py-2">
                        <div>{formatCurrency(periodTotals.spend.labor)}</div>
                        <div className="text-xs font-normal text-[#525252]">
                          {spendUsagePct(periodTotals.spend.labor, periodTotals.budgets.labor)} del P. MO
                        </div>
                      </td>
                      <td className="text-right tabular-nums py-2">
                        <div>{formatCurrency(periodTotals.spend.supplies)}</div>
                        <div className="text-xs font-normal text-[#525252]">
                          {spendUsagePct(periodTotals.spend.supplies, periodTotals.budgets.supplies)} del P. ins.
                        </div>
                      </td>
                      <td className="text-right tabular-nums py-2">
                        <div>{formatCurrency(periodTotals.spend.admin)}</div>
                        <div className="text-xs font-normal text-[#525252]">
                          {spendUsagePct(periodTotals.spend.admin, periodTotals.budgets.admin)} del P. adm.
                        </div>
                      </td>
                      <td className="text-right tabular-nums py-2">
                        <div>{formatCurrency(periodTotals.spend.profit)}</div>
                        <div className="text-xs font-normal text-[#525252]">
                          {spendUsagePct(periodTotals.spend.profit, periodTotals.budgets.profit)} del P. util.
                        </div>
                      </td>
                      <td colSpan={6} />
                    </tr>
                    <tr>
                      <td colSpan={5} className="py-2 align-top text-sm font-medium">
                        Detalle del gasto (suma de todos los contratos)
                      </td>
                      <td colSpan={11} className="py-2">
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
                          {Object.entries(periodTotals.expensesByType)
                            .filter(([, amount]) => amount > 0)
                            .sort((a, b) => b[1] - a[1])
                            .map(([type, amount]) => (
                              <span key={type} className="tabular-nums whitespace-nowrap">
                                <span className="text-[#525252]">{expenseTypeLabel(type)}:</span>{" "}
                                <span className="font-medium">{formatCurrency(amount)}</span>
                              </span>
                            ))}
                          {Object.keys(periodTotals.expensesByType).length === 0 && (
                            <span className="text-[#8d8d8d]">Sin gastos registrados en el mes</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  </>
                ) : (
                  <tr>
                    <td colSpan={16} className="py-2 text-sm text-[#525252]">
                      Seleccione un mes para ver presupuesto y gasto consolidados.
                    </td>
                  </tr>
                )}
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
