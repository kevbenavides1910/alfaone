"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils/format";
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
  total: number;
  items: ReportePagoItem[];
};

type CategoryGroup = {
  key: string;
  label: string;
  total: number;
  subcategories: Subgroup[];
};

const FUENTE_SHORT: Record<string, string> = {
  EXPENSE: "Gasto",
  APEX: "E. fijo",
  MANUAL: "Manual",
};

function buildReport(payments: ReportePagoItem[]): CategoryGroup[] {
  const paid = payments.filter((p) => p.paid);
  const byCat = new Map<string, Map<string, ReportePagoItem[]>>();

  for (const p of paid) {
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
      items.sort((a, b) => a.paymentDate.localeCompare(b.paymentDate) || a.description.localeCompare(b.description));
      const total = Math.round(items.reduce((s, i) => s + i.amount, 0) * 100) / 100;
      subcategories.push({
        key: subKey,
        label:
          catKey === "__NONE__" || subKey === "__NONE__"
            ? subKey === "__NONE__"
              ? "Sin subcategoría"
              : paymentSubcategoryLabel(catKey, subKey) ?? subKey
            : paymentSubcategoryLabel(catKey, subKey) ?? subKey,
        total,
        items,
      });
    }
    subcategories.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, "es"));
    const total = Math.round(subcategories.reduce((s, g) => s + g.total, 0) * 100) / 100;
    groups.push({
      key: catKey,
      label: catKey === "__NONE__" ? "Sin clasificar" : paymentCategoryLabel(catKey) ?? catKey,
      total,
      subcategories,
    });
  }

  groups.sort((a, b) => {
    if (a.key === "__NONE__") return 1;
    if (b.key === "__NONE__") return -1;
    return b.total - a.total || a.label.localeCompare(b.label, "es");
  });
  return groups;
}

export function PagosReporteMensual({
  monthLabel,
  payments,
  loading,
  onViewDetail,
}: {
  monthLabel: string;
  payments: ReportePagoItem[];
  loading?: boolean;
  onViewDetail?: (id: string) => void;
}) {
  const groups = useMemo(() => buildReport(payments), [payments]);
  const grandTotal = useMemo(
    () => Math.round(groups.reduce((s, g) => s + g.total, 0) * 100) / 100,
    [groups],
  );
  const paidCount = useMemo(() => payments.filter((p) => p.paid).length, [payments]);

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
          Pagos marcados en verde del mes ({monthLabel}), agrupados por categoría y subcategoría.
        </p>
        <p className="text-sm text-muted-foreground py-8 text-center">
          No hay pagos marcados como pagados en este mes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-medium">Reporte mensual de gasto — {monthLabel}</p>
          <p className="text-xs text-muted-foreground">
            Solo pagos marcados en verde. Abrí categoría → subcategoría para ver el detalle.
          </p>
        </div>
        <div className="text-sm text-right">
          <div className="text-muted-foreground text-xs">{paidCount} pago(s)</div>
          <div className="font-semibold text-emerald-700">{formatCurrency(grandTotal)}</div>
        </div>
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
                {catOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="flex-1 font-medium">{cat.label}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {cat.subcategories.length} subcategoría(s)
                </span>
                <span className="font-semibold tabular-nums shrink-0 min-w-[7rem] text-right">
                  {formatCurrency(cat.total)}
                </span>
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
                          className="flex w-full items-center gap-2 pl-8 pr-3 py-2 text-left text-sm hover:bg-muted/40"
                          onClick={() => toggleSub(cat.key, sub.key)}
                          aria-expanded={subOpen}
                        >
                          {subOpen ? (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          )}
                          <span className="flex-1">{sub.label}</span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {sub.items.length}
                          </span>
                          <span className="font-medium tabular-nums shrink-0 min-w-[7rem] text-right">
                            {formatCurrency(sub.total)}
                          </span>
                        </button>

                        {subOpen && (
                          <ul className="pb-2 pl-12 pr-3 space-y-1">
                            {sub.items.map((item) => (
                              <li key={item.id}>
                                <button
                                  type="button"
                                  className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded px-2 py-1.5 text-left text-xs hover:bg-background"
                                  onClick={() => onViewDetail?.(item.id)}
                                >
                                  <span className="text-muted-foreground shrink-0 tabular-nums">
                                    {formatDate(item.paymentDate)}
                                  </span>
                                  <span className="min-w-0 flex-1 font-medium truncate" title={item.description}>
                                    {item.description}
                                  </span>
                                  <span className="text-muted-foreground shrink-0">
                                    {FUENTE_SHORT[item.source] ?? item.source}
                                    {item.company ? ` · ${item.company}` : ""}
                                    {item.referenceNumber ? ` · OC ${item.referenceNumber}` : ""}
                                  </span>
                                  <span className="font-semibold tabular-nums shrink-0 text-emerald-700">
                                    {formatCurrency(item.amount)}
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
