"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "@/lib/auth/client-session";
import Link from "next/link";
import {
  Edit, Trash2,
  DollarSign, Users, Calendar, TrendingUp, TrendingDown, Minus
} from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { ContractsPageHeader } from "@/components/contracts/ContractsPageHeader";
import { CarbonStatTile } from "@/components/contracts/CarbonStatTile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetBar } from "@/components/shared/BudgetBar";
import { TrafficLightBadge } from "@/components/shared/TrafficLightBadge";
import { toast } from "@/components/ui/toaster";
import { formatCurrency, formatDate, formatPct, formatBillingPeriodRange } from "@/lib/utils/format";
import { companyDisplayName, CLIENT_TYPE_LABELS, CONTRACT_STATUS_LABELS, HIRING_TYPE_LABELS, TrafficLight, calcTrafficLight } from "@/lib/utils/constants";
import { useCompanies } from "@/lib/hooks/use-companies";
// calcTrafficLight used in BudgetBar lifetime section
import { PeriodsTab } from "@/components/contracts/PeriodsTab";
import { PositionsTab } from "@/components/contracts/PositionsTab";
import { BillingHistoryTab } from "@/components/contracts/BillingHistoryTab";
import { OnDemandBillingTab } from "@/components/contracts/OnDemandBillingTab";
import { BillingRequirementsTab } from "@/components/contracts/BillingRequirementsTab";
import { ClientContactsTab } from "@/components/contracts/ClientContactsTab";
import { ContractExpensesTab } from "@/components/contracts/ContractExpensesTab";
import { AssetsTab } from "@/components/contracts/AssetsTab";
import { AdministrationsTab } from "@/components/contracts/AdministrationsTab";
import { canModifyContracts, canManageExpenses, isAdmin } from "@/modules/core/permissions";
import { canViewContractTab, canEditContractTab } from "@/lib/permissions/contract-tabs";
import type { ContractStatus, ClientType, ContractHiringType } from "@prisma/client";

interface Contract {
  id: string; licitacionNo: string; company: string; client: string;
  clientType: ClientType; hiringType: ContractHiringType;
  officersCount: number; positionsCount: number;
  status: ContractStatus; startDate: string; endDate: string;
  baseMonthlyBilling: number;
  monthlyBilling: number; suppliesBudgetPct: number; suppliesBudget: number;
  equivalencePct: number; notes?: string;
  ivaPct: number;
  billingDay: number;
  billingPeriodFromDay: number;
  billingPeriodToDay: number;
  laborPct: number; suppliesPct: number; adminPct: number; profitPct: number;
  totalSuppliesBudget: number; suppliesSharePct: number;
  periods: { id: string; periodNumber: number; startDate: string; endDate: string; monthlyBilling: number }[];
}

interface Profitability {
  suppliesBudget: number;
  uniformsTotal: number; auditTotal: number; deferredTotal: number; adminTotal: number;
  directTotal: number; expenseDistTotal: number;
  directByType: Record<string, number>;
  expenseDistByType: Record<string, number>;
  expensesByType: Record<string, number>;
  grandTotal: number;
  budgetUsagePctFormatted: number; trafficLight: TrafficLight; remaining: number;
  lifetime?: {
    totalBilled: number;
    totalSpecialServices?: number;
    totalBudget: number;
    totalExpenses: number;
    totalMonths: number;
    surplus: number;
  };
}

export default function ContractDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const canEditContract = canModifyContracts(session ?? null);
  const canEditExpenses = canManageExpenses(session ?? null);
  const canDeleteContract = isAdmin(session ?? null);
  const canViewOverview = canViewContractTab(session, "overview");
  const canViewLocations = canViewContractTab(session, "locations");
  const canViewAssets = canViewContractTab(session, "assets");
  const canViewBilling = canViewContractTab(session, "billing");
  const canViewDemandBilling = canViewContractTab(session, "demand_billing");
  const canViewBillingRequirements = canViewContractTab(session, "billing_requirements");
  const canViewAdministrations = canViewContractTab(session, "administrations");
  const canEditAdministrations = canEditContractTab(session, "administrations");
  const canViewClientContacts = canViewContractTab(session, "client_contacts");
  const canViewPeriods = canViewContractTab(session, "periods");
  const canViewExpenses = canViewContractTab(session, "expenses");

  const { data: companiesRes } = useCompanies();
  const companyRows = companiesRes?.data ?? [];

  const { data: contractData, isLoading } = useQuery<{ data: Contract }>({
    queryKey: ["contract", id],
    queryFn: () => fetch(`/api/contracts/${id}`).then((r) => r.json()),
  });

  const { data: profData } = useQuery<{ data: Profitability }>({
    queryKey: ["profitability", id],
    queryFn: () => fetch(`/api/contracts/${id}/profitability`).then((r) => r.json()),
  });

  const deleteMutation = useMutation({
    mutationFn: () => fetch(`/api/contracts/${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contracts"] });
      toast.success("Contrato eliminado");
      router.push("/contracts");
    },
    onError: () => toast.error("Error al eliminar contrato"),
  });

  if (isLoading) {
    return (
      <>
        <Topbar title="Detalle de contrato" />
        <div className="carbon-empty">Cargando…</div>
      </>
    );
  }

  const contract = contractData?.data;
  if (!contract) return null;

  const visibleTabs = [
    { value: "overview", label: "Resumen", show: canViewOverview },
    { value: "locations", label: "Ubicaciones", show: canViewLocations },
    { value: "assets", label: "Activos", show: canViewAssets },
    { value: contract.hiringType === "ON_DEMAND" ? "demand-billing" : "billing", label: contract.hiringType === "ON_DEMAND" ? "Facturación por demanda" : "Registro de venta", show: contract.hiringType === "ON_DEMAND" ? canViewDemandBilling : canViewBilling },
    { value: "billing-requirements", label: "Requisitos de facturación", show: canViewBillingRequirements },
    { value: "administrations", label: "Administraciones", show: canViewAdministrations },
    { value: "client-contacts", label: "Contacto del cliente", show: canViewClientContacts },
    { value: "periods", label: "Prórrogas", show: canViewPeriods },
    { value: "expenses", label: "Todos los gastos", show: canViewExpenses },
  ].filter((t) => t.show);
  const defaultTab = visibleTabs[0]?.value ?? "overview";

  const prof = profData?.data;
  const tl = prof?.trafficLight ?? "GREEN";

  const statusColors: Record<ContractStatus, "success" | "warning" | "secondary" | "destructive"> = {
    ACTIVE: "success", PROLONGATION: "warning", SUSPENDED: "warning",
    FINISHED: "secondary", CANCELLED: "destructive",
  };

  return (
    <>
      <Topbar title={contract.licitacionNo} />
      <ContractsPageHeader
        title={contract.licitacionNo}
        description={`${contract.client} · ${CLIENT_TYPE_LABELS[contract.clientType]} · ${HIRING_TYPE_LABELS[contract.hiringType ?? "FIXED"]}`}
        breadcrumbs={[
          { label: "Contratos", href: "/contracts" },
          { label: contract.licitacionNo },
        ]}
        actions={
          <>
            <div className="flex flex-wrap items-center gap-2 mr-2">
              <Badge variant={statusColors[contract.status]} className="rounded-sm font-normal">
                {CONTRACT_STATUS_LABELS[contract.status]}
              </Badge>
              <Badge variant="outline" className="rounded-sm border-[#c6c6c6] font-normal">
                {companyDisplayName(contract.company, companyRows)}
              </Badge>
              {prof && <TrafficLightBadge light={tl} pct={prof.budgetUsagePctFormatted} />}
            </div>
            {canEditContract && (
              <Link href={`/contracts/${id}/edit`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 rounded-sm border-[#c6c6c6] bg-white shadow-none hover:bg-[#e8e8e8]"
                >
                  <Edit className="h-4 w-4" />
                  Editar
                </Button>
              </Link>
            )}
            {canDeleteContract && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-sm border-[#da1e28] bg-white text-[#da1e28] shadow-none hover:bg-[#fff1f1]"
                onClick={() => {
                  if (confirm("¿Eliminar este contrato? Esta acción es irreversible.")) {
                    deleteMutation.mutate();
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-0 pb-8">
        {prof?.lifetime && (() => {
          const lt = prof.lifetime!;
          const usagePct = lt.totalBudget > 0 ? lt.totalExpenses / lt.totalBudget : 0;
          const isOver = lt.surplus < 0;
          const isGood = lt.surplus >= 0;
          return (
            <div className="grid grid-cols-1 gap-0 border-y border-[#e0e0e0] md:grid-cols-2">
              <CarbonStatTile
                label="Facturado desde inicio"
                value={formatCurrency(lt.totalBilled)}
                helper={`${lt.totalMonths} mes${lt.totalMonths !== 1 ? "es" : ""} · ${formatCurrency(contract.monthlyBilling)}/mes${
                  (lt.totalSpecialServices ?? 0) > 0
                    ? ` · ${formatCurrency(lt.totalSpecialServices!)} servicios especiales`
                    : ""
                }`}
                icon={DollarSign}
                accent="blue"
                className="border-x-0 border-t-0 border-b md:border-b-0 md:border-r"
              />
              <CarbonStatTile
                label="Gastos acumulados"
                value={formatCurrency(lt.totalExpenses)}
                helper={`${(usagePct * 100).toFixed(1)}% del presupuesto · ${
                  isGood ? "+" : ""
                }${formatCurrency(lt.surplus)}`}
                icon={isOver ? TrendingDown : isGood ? TrendingUp : Minus}
                accent={isOver ? "red" : "green"}
                className="border-x-0 border-t-0"
              />
            </div>
          );
        })()}

        <div className="grid grid-cols-1 gap-0 border-b border-[#e0e0e0] sm:grid-cols-3">
          <CarbonStatTile
            label="Facturación mensual"
            value={formatCurrency(contract.monthlyBilling)}
            icon={DollarSign}
            accent="blue"
            className="border-x-0 border-t-0 border-b sm:border-b-0 sm:border-r"
          />
          <CarbonStatTile
            label="Personal"
            value={`${contract.officersCount} oficiales`}
            helper={`${contract.positionsCount} puestos`}
            icon={Users}
            accent="purple"
            className="border-x-0 border-t-0 border-b sm:border-b-0 sm:border-r"
          />
          <CarbonStatTile
            label="Vigencia"
            value={formatDate(contract.endDate)}
            helper={`Inicio: ${formatDate(contract.startDate)}`}
            icon={Calendar}
            accent="gray"
            className="border-x-0 border-t-0"
          />
        </div>

        {visibleTabs.length === 0 ? (
          <div className="carbon-panel mx-4 mt-6 md:mx-6 border p-8 text-center text-sm text-slate-500">
            No tienes permisos para ver las pestañas de este contrato.
          </div>
        ) : (
        <Tabs defaultValue={defaultTab} className="carbon-panel mx-4 mt-6 md:mx-6 border-x border-t">
          <TabsList className="carbon-tabs-list">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="carbon-tabs-trigger">{t.label}</TabsTrigger>
            ))}
          </TabsList>

          {canViewOverview && (
          <TabsContent value="overview" className="mt-0 p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Expense breakdown */}
              {prof && (() => {
                const EXPENSE_TYPE_META: Record<string, { label: string; color: string; bar: string }> = {
                  APERTURA:  { label: "Apertura",       color: "text-red-600",   bar: "bg-slate-400" },
                  UNIFORMS:  { label: "Uniformes",      color: "text-purple-600", bar: "bg-purple-400" },
                  AUDIT:     { label: "Auditoría",      color: "text-orange-600", bar: "bg-orange-400" },
                  ADMIN:     { label: "Administrativo", color: "text-slate-600",  bar: "bg-slate-400" },
                  TRANSPORT: { label: "Transporte",     color: "text-cyan-600",   bar: "bg-cyan-400" },
                  FUEL:      { label: "Combustible",    color: "text-yellow-600", bar: "bg-yellow-400" },
                  PHONES:    { label: "Teléfonos",      color: "text-green-600",  bar: "bg-green-400" },
                  PLANILLA:  { label: "Planilla",       color: "text-emerald-600", bar: "bg-emerald-400" },
                  OTHER:     { label: "Otros",          color: "text-gray-600",   bar: "bg-gray-400" },
                };

                // Unified buckets: new Expense table (direct + distributed) + legacy tables folded in
                const buckets: Record<string, number> = { ...prof.expensesByType };
                // Legacy tables: fold into type buckets (for contracts with pre-existing data)
                if (prof.uniformsTotal > 0) buckets["UNIFORMS"] = (buckets["UNIFORMS"] ?? 0) + prof.uniformsTotal;
                if (prof.auditTotal    > 0) buckets["AUDIT"]    = (buckets["AUDIT"]    ?? 0) + prof.auditTotal;
                // Legacy deferred/admin distributions stay as separate lines (no type info available)
                const legacyLines = [
                  { label: "Diferidos legacy (dist.)",        value: prof.deferredTotal, color: "text-slate-500", bar: "bg-slate-300" },
                  { label: "Administrativos legacy (dist.)",  value: prof.adminTotal,    color: "text-slate-400",  bar: "bg-slate-300" },
                ].filter(l => l.value > 0);

                const allLines = [
                  ...Object.entries(buckets)
                    .filter(([, v]) => v > 0)
                    .map(([type, value]) => ({
                      label: EXPENSE_TYPE_META[type]?.label ?? type,
                      value,
                      color: EXPENSE_TYPE_META[type]?.color ?? "text-slate-600",
                      bar:   EXPENSE_TYPE_META[type]?.bar   ?? "bg-slate-400",
                    }))
                    .sort((a, b) => b.value - a.value),
                  ...legacyLines,
                ];

                return (
                  <Card className="rounded-none border-[#e0e0e0] shadow-none">
                    <CardHeader className="border-b border-[#e0e0e0] bg-[#f4f4f4] py-4">
                      <CardTitle className="text-sm font-semibold text-[#161616]">Desglose de gastos acumulados</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {allLines.length === 0 && (
                        <p className="text-sm text-slate-400 text-center py-4">Sin gastos registrados</p>
                      )}
                      {allLines.map((item) => {
                        const pct = prof.grandTotal > 0 ? (item.value / prof.grandTotal) * 100 : 0;
                        return (
                          <div key={item.label} className="py-1.5 border-b last:border-0">
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-sm text-slate-600">{item.label}</span>
                              <span className={`text-sm font-semibold ${item.color}`}>{formatCurrency(item.value)}</span>
                            </div>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div className={`${item.bar} h-1.5 rounded-full`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex justify-between items-center pt-2 font-bold border-t">
                        <span>Total Gastos</span>
                        <span className={prof.grandTotal > (prof.lifetime?.totalBudget ?? prof.suppliesBudget) ? "text-red-600" : "text-slate-800"}>
                          {formatCurrency(prof.grandTotal)}
                        </span>
                      </div>
                      {prof.lifetime && (
                        <div className="mt-1">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>vs. presupuesto acumulado ({formatCurrency(prof.lifetime.totalBudget)})</span>
                            <span className={prof.lifetime.surplus >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                              {prof.lifetime.surplus >= 0 ? "+" : ""}{formatCurrency(prof.lifetime.surplus)}
                            </span>
                          </div>
                          <BudgetBar
                            pct={prof.lifetime.totalBudget > 0 ? (prof.lifetime.totalExpenses / prof.lifetime.totalBudget) * 100 : 0}
                            light={calcTrafficLight(prof.lifetime.totalBudget > 0 ? prof.lifetime.totalExpenses / prof.lifetime.totalBudget : 0)}
                            showLabel={false}
                            height="md"
                          />
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })()}

              {/* Contract info */}
              <div className="space-y-4">
                <Card className="rounded-none border-[#e0e0e0] shadow-none">
                  <CardHeader className="border-b border-[#e0e0e0] bg-[#f4f4f4] py-4">
                    <CardTitle className="text-sm font-semibold text-[#161616]">Datos del contrato</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 p-4 text-sm">
                    {[
                      { label: "N° Licitación", value: contract.licitacionNo },
                      { label: "Empresa", value: companyDisplayName(contract.company, companyRows) },
                      { label: "Cliente", value: contract.client },
                      { label: "Tipo de cliente", value: CLIENT_TYPE_LABELS[contract.clientType] },
                      { label: "Contratación", value: HIRING_TYPE_LABELS[contract.hiringType ?? "FIXED"] },
                      { label: "% IVA", value: `${Number(contract.ivaPct ?? 13)}%` },
                      {
                        label: "Día de facturación",
                        value: `Día ${contract.billingDay ?? 1} de cada mes`,
                      },
                      {
                        label: "Periodo que se factura",
                        value: formatBillingPeriodRange(
                          contract.billingPeriodFromDay,
                          contract.billingPeriodToDay
                        ),
                      },
                      { label: "Equivalencia", value: formatPct(contract.equivalencePct) },
                      { label: "Inicio", value: formatDate(contract.startDate) },
                      { label: "Cierre", value: formatDate(contract.endDate) },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between border-b border-[#e0e0e0] pb-2 last:border-0">
                        <span className="text-[#525252]">{row.label}</span>
                        <span className="font-medium text-right text-[#161616]">{row.value}</span>
                      </div>
                    ))}
                    {contract.notes && (
                      <div className="pt-2">
                        <span className="text-slate-500 text-xs block mb-1">Notas</span>
                        <p className="text-sm">{contract.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Budget distribution */}
                {(contract.laborPct > 0 || contract.suppliesPct > 0 || contract.adminPct > 0 || contract.profitPct > 0) && (
                  <Card className="rounded-none border-[#e0e0e0] shadow-none">
                    <CardHeader className="border-b border-[#e0e0e0] bg-[#f4f4f4] py-4">
                      <CardTitle className="text-sm font-semibold text-[#161616]">Distribución del contrato</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 p-4 text-sm">
                      {[
                        { label: "Mano de obra",         pct: contract.laborPct,    color: "bg-blue-500" },
                        { label: "Insumos",              pct: contract.suppliesPct, color: "bg-purple-500" },
                        { label: "Gasto administrativo", pct: contract.adminPct,    color: "bg-orange-500" },
                        { label: "Utilidad",             pct: contract.profitPct,   color: "bg-green-500" },
                      ].filter(r => r.pct > 0).map(row => (
                        <div key={row.label}>
                          <div className="flex justify-between mb-1">
                            <span className="text-slate-600">{row.label}</span>
                            <span className="font-semibold">
                              {(row.pct * 100).toFixed(1)}% — {formatCurrency(contract.monthlyBilling * row.pct)}
                            </span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div className={`${row.color} h-1.5 rounded-full`} style={{ width: `${row.pct * 100}%` }} />
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-between pt-2 border-t font-semibold">
                        <span>Total distribuido</span>
                        <span className={(contract.laborPct + contract.suppliesPct + contract.adminPct + contract.profitPct) > 0.999
                          ? "text-green-600" : "text-yellow-600"}>
                          {((contract.laborPct + contract.suppliesPct + contract.adminPct + contract.profitPct) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
          )}

          {canViewLocations && (
          <TabsContent value="locations" className="mt-0 p-4 md:p-6">
            <PositionsTab contractId={id} readOnly={!canEditContract} />
          </TabsContent>
          )}

          {canViewAssets && (
          <TabsContent value="assets" className="mt-0 p-4 md:p-6">
            <AssetsTab contractId={id} readOnly={!canEditExpenses} />
          </TabsContent>
          )}

          {contract.hiringType === "ON_DEMAND" ? (
            canViewDemandBilling && (
            <TabsContent value="demand-billing" className="mt-0 p-4 md:p-6">
              <OnDemandBillingTab contractId={id} readOnly={!canEditContract} />
            </TabsContent>
            )
          ) : (
            canViewBilling && (
            <TabsContent value="billing" className="mt-0 p-4 md:p-6">
              <BillingHistoryTab
                contractId={id}
                monthlyBilling={contract.monthlyBilling}
                contractBaseBilling={contract.baseMonthlyBilling}
                readOnly={!canEditContract}
              />
            </TabsContent>
            )
          )}

          {canViewBillingRequirements && (
          <TabsContent value="billing-requirements" className="mt-0 p-4 md:p-6">
            <BillingRequirementsTab contractId={id} readOnly={!canEditContract} />
          </TabsContent>
          )}

          {canViewAdministrations && (
            <TabsContent value="administrations" className="mt-0 p-4 md:p-6">
              <AdministrationsTab contractId={id} readOnly={!canEditAdministrations} />
            </TabsContent>
          )}

          {canViewClientContacts && (
          <TabsContent value="client-contacts" className="mt-0 p-4 md:p-6">
            <ClientContactsTab
              contractId={id}
              readOnly={!canEditContract}
              ivaPct={contract.ivaPct}
              billingDay={contract.billingDay}
              billingPeriodFromDay={contract.billingPeriodFromDay}
              billingPeriodToDay={contract.billingPeriodToDay}
            />
          </TabsContent>
          )}

          {canViewPeriods && (
          <TabsContent value="periods" className="mt-0 p-4 md:p-6">
            <PeriodsTab contractId={id} periods={contract.periods} readOnly={!canEditContract} />
          </TabsContent>
          )}

          {canViewExpenses && (
          <TabsContent value="expenses" className="mt-0 p-4 md:p-6">
            <ContractExpensesTab contractId={id} canManageExpenses={canEditExpenses} />
          </TabsContent>
          )}
        </Tabs>
        )}
      </div>
    </>
  );
}
