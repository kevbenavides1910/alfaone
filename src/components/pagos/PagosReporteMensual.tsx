"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
import {
  roundMoney,
  spendProgressPct,
} from "@/modules/pagos/business/reporte-mensual";
import {
  paymentCategoryLabel,
  paymentSubcategoryLabel,
} from "@/modules/pagos/catalog/payment-categories";

export type ReportePagoItem = {
  id: string;
  description: string;
  amount: number;
  paymentDate: string;
  company: string | null;
  source: string;
  referenceNumber: string | null;
  category: string | null;
  subcategory: string | null;
  paid: boolean;
};

type Subgroup = {
  key: string;
  label: string;
  paid: number;
  projected: number;
  items: ReportePagoItem[];
};

type CategoryGroup = {
  key: string;
  label: string;
  paid: number;
  projected: number;
  subcategories: Subgroup[];
};

const FUENTE_SHORT: Record<string, string> = {
  EXPENSE: "Gasto",
  APEX: "E. fijo",
  MANUAL: "Manual",
};

const COL_PAID = "w-[8.75rem]";
const COL_PROJECTED = "w-[8.75rem]";
const COL_PROGRESS = "w-[7.5rem]";

function buildReport(payments: ReportePagoItem[]): CategoryGroup[] {
  const byCat = new Map<string, Map<string, ReportePagoItem[]>>();

  for (const p of payments) {
    const catKey = p.category?.trim() || "__NONE__";
    const subKey = p.subcategory?.trim() || "__NONE__";
    if (!byCat.has(catKey)) byCat.set(catKey, new Map());
    const bySub = byCat.get(catKey)!;
    if (!bySub.has(subKey)) bySub.set(subKey, []);
    bySub.get(subKey)!.push(p);
  }

  const groups: CategoryGroup[] = [];
  for (const [catKey, bySub] of byCat) {
    const subcategories: Subgroup[] = [];
    for (const [subKey, items] of bySub) {
      items.sort(
        (a, b) =>
          a.paymentDate.localeCompare(b.paymentDate) ||
          a.description.localeCompare(b.description),
      );
      const paid = roundMoney(items.filter((i) => i.paid).reduce((s, i) => s + i.amount, 0));
      const projected = roundMoney(items.filter((i) => !i.paid).reduce((s, i) => s + i.amount, 0));
      subcategories.push({
        key: subKey,
        label:
          catKey === "__NONE__" || subKey === "__NONE__"
            ? subKey === "__NONE__"
              ? "Sin subcategoría"
              : paymentSubcategoryLabel(catKey, subKey) ?? subKey
            : paymentSubcategoryLabel(catKey, subKey) ?? subKey,
        paid,
        projected,
        items,
      });
    }
    subcategories.sort(
      (a, b) =>
        b.paid + b.projected - (a.paid + a.projected) || a.label.localeCompare(b.label, "es"),
    );
    groups.push({
      key: catKey,
      label: catKey === "__NONE__" ? "Sin clasificar" : paymentCategoryLabel(catKey) ?? catKey,
      paid: roundMoney(subcategories.reduce((s, g) => s + g.paid, 0)),
      projected: roundMoney(subcategories.reduce((s, g) => s + g.projected, 0)),
      subcategories,
    });
  }

  groups.sort((a, b) => {
    if (a.key === "__NONE__") return 1;
    if (b.key === "__NONE__") return -1;
    return b.paid + b.projected - (a.paid + a.projected) || a.label.localeCompare(b.label, "es");
  });
  return groups;
}

function AvanceBar({
  paid,
  projected,
  size = "sm",
}: {
  paid: number;
  projected: number;
  size?: "sm" | "md";
}) {
  const pct = spendProgressPct(paid, projected);
  return (
    <div
      className={`flex items-center gap-1.5 ${size === "md" ? "min-w-[10rem] flex-1" : COL_PROGRESS}`}
      title={`Avance ${pct}%`}
    >
      <div
        className={`${size === "md" ? "h-2" : "h-1.5"} flex-1 overflow-hidden rounded-full bg-muted`}
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avance ${pct}%`}
      >
        <div className="h-full rounded-full bg-emerald-600" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{pct}%</span>
    </div>
  );
}

function AmountSplit({ paid, projected }: { paid: number; projected: number }) {
  return (
    <>
      <span className={`${COL_PAID} shrink-0 text-right font-semibold tabular-nums text-emerald-700`}>
        {formatCurrency(paid)}
      </span>
      <span className={`${COL_PROJECTED} shrink-0 text-right font-medium tabular-nums text-amber-700`}>
        {formatCurrency(projected)}
      </span>
      <AvanceBar paid={paid} projected={projected} />
    </>
  );
}

export function PagosReporteMensual({
  monthLabel,
  payments,
  loading,
  onViewDetail,
  formatCompany,
}: {
  monthLabel: string;
  payments: ReportePagoItem[];
  loading?: boolean;
  onViewDetail?: (id: string) => void;
  formatCompany?: (code: string | null) => string;
}) {
  const groups = useMemo(() => buildReport(payments), [payments]);
  const totals = useMemo(() => {
    const paid = roundMoney(groups.reduce((s, g) => s + g.paid, 0));
    const projected = roundMoney(groups.reduce((s, g) => s + g.projected, 0));
    return { paid, projected, avancePct: spendProgressPct(paid, projected) };
  }, [groups]);
  const paidCount = useMemo(() => payments.filter((p) => p.paid).length, [payments]);
  const projectedCount = payments.length - paidCount;

  const [openCats, setOpenCats] = useState<Record<string, boolean>>({});
  const [openSubs, setOpenSubs] = useState<Record<string, boolean>>({});

  function toggleCat(key: string) {
    setOpenCats((prev) => ({ ...prev, [key]: !prev[key] }));
  }
  function toggleSub(catKey: string, subKey: string) {
    const id = `${catKey}::${subKey}`;
    setOpenSubs((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center animate-pulse">
        Cargando reporte…
      </p>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">
          Pagado (verde) y proyectado (programado y aún no pagado) de {monthLabel}.
        </p>
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay pagos programados en este mes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Reporte mensual de gasto — {monthLabel}</p>
          <p className="text-xs text-muted-foreground max-w-xl">
            Pagado: marcados en verde. Proyectado: programados en el calendario y aún no pagados.
            El avance es lo pagado sobre el total del mes.
          </p>
        </div>
      </div>

      <div className="rounded-md border bg-muted/30 px-3 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <div>
              <span className="text-xs text-muted-foreground">Pagado </span>
              <span className="font-semibold text-emerald-700">{formatCurrency(totals.paid)}</span>
              <span className="ml-1 text-xs text-muted-foreground">({paidCount})</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Proyectado </span>
              <span className="font-semibold text-amber-700">{formatCurrency(totals.projected)}</span>
              <span className="ml-1 text-xs text-muted-foreground">({projectedCount})</span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Total </span>
              <span className="font-semibold">{formatCurrency(roundMoney(totals.paid + totals.projected))}</span>
            </div>
          </div>
          <div className="flex min-w-[220px] max-w-sm flex-1 items-center gap-2">
            <span className="shrink-0 text-xs text-muted-foreground">Avance</span>
            <AvanceBar paid={totals.paid} projected={totals.projected} size="md" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 text-[11px] uppercase tracking-wide text-muted-foreground">
        <span className="flex-1">Categoría</span>
        <span className={`${COL_PAID} shrink-0 text-right`}>Pagado</span>
        <span className={`${COL_PROJECTED} shrink-0 text-right`}>Proyectado</span>
        <span className={`${COL_PROGRESS} shrink-0 text-right`}>Avance</span>
      </div>

      <ul className="rounded-md border divide-y bg-card">
        {groups.map((cat) => {
          const catOpen = Boolean(openCats[cat.key]);
          return (
            <li key={cat.key}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-muted/50"
                onClick={() => toggleCat(cat.key)}
                aria-expanded={catOpen}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2 font-medium">
                  {catOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="min-w-0 truncate">
                    {cat.label}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {cat.subcategories.length} subcategoría(s)
                    </span>
                  </span>
                </span>
                <AmountSplit paid={cat.paid} projected={cat.projected} />
              </button>

              {catOpen && (
                <ul className="border-t bg-muted/20">
                  {cat.subcategories.map((sub) => {
                    const subId = `${cat.key}::${sub.key}`;
                    const subOpen = Boolean(openSubs[subId]);
                    return (
                      <li key={subId} className="border-b last:border-b-0">
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 py-2 pl-8 pr-3 text-left text-sm hover:bg-muted/40"
                          onClick={() => toggleSub(cat.key, sub.key)}
                          aria-expanded={subOpen}
                        >
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            {subOpen ? (
                              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            )}
                            <span className="min-w-0 truncate">
                              {sub.label}
                              <span className="ml-2 text-xs text-muted-foreground">{sub.items.length}</span>
                            </span>
                          </span>
                          <AmountSplit paid={sub.paid} projected={sub.projected} />
                        </button>

                        {subOpen && (
                          <ul className="space-y-1 pb-2 pl-12 pr-3">
                            {sub.items.map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 rounded py-1.5 pl-2 pr-0 text-left text-xs hover:bg-background"
                                  onClick={() => onViewDetail?.(item.id)}
                                >
                                  <span className="shrink-0 tabular-nums text-muted-foreground">
                                    {formatDate(item.paymentDate)}
                                  </span>
                                  <span className="min-w-0 flex-1 truncate font-medium" title={item.description}>
                                    {item.description}
                                  </span>
                                  <span className="shrink-0 text-muted-foreground">
                                    {FUENTE_SHORT[item.source] ?? item.source}
                                    {item.company
                                      ? ` · ${formatCompany ? formatCompany(item.company) : item.company}`
                                      : ""}
                                    {item.referenceNumber ? ` · OC ${item.referenceNumber}` : ""}
                                  </span>
                                  <span
                                    className={`${COL_PAID} shrink-0 text-right font-semibold tabular-nums text-emerald-700`}
                                  >
                                    {item.paid ? formatCurrency(item.amount) : ""}
                                  </span>
                                  <span
                                    className={`${COL_PROJECTED} shrink-0 text-right font-semibold tabular-nums text-amber-700`}
                                  >
                                    {!item.paid ? formatCurrency(item.amount) : ""}
                                  </span>
                                  <span className={`${COL_PROGRESS} shrink-0 text-right text-[11px] text-muted-foreground`}>
                                    {item.paid ? "Pagado" : "Proyectado"}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
