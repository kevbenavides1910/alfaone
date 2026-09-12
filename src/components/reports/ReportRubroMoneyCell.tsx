"use client";

import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import type { TrafficLight } from "@/lib/utils/constants";

const TINT: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-50",
  YELLOW: "bg-amber-50",
  RED: "bg-red-50",
};

const AMOUNT: Record<TrafficLight, string> = {
  GREEN: "text-emerald-800",
  YELLOW: "text-amber-900",
  RED: "text-red-800",
};

type Props = {
  spend: number;
  budget: number;
  usagePct?: number;
  trafficLight?: TrafficLight;
  cargasSocialesSpend?: number;
  onSpendClick?: () => void;
  showBadge?: boolean;
};

export function ReportRubroMoneyCell({
  spend,
  budget,
  usagePct,
  trafficLight,
  cargasSocialesSpend,
  onSpendClick,
  showBadge = true,
}: Props) {
  const clickable = spend > 0 && Boolean(onSpendClick);
  const spendLabel = spend > 0 ? formatCurrency(spend) : "—";
  const amountClass = trafficLight ? AMOUNT[trafficLight] : "text-slate-900";
  const title = [
    spend > 0 ? `Gasto ${formatCurrency(spend)}` : null,
    `Presupuesto ${formatCurrency(budget)}`,
    (cargasSocialesSpend ?? 0) > 0
      ? `Cargas sociales ${formatCurrency(cargasSocialesSpend!)} (incluidas en el gasto)`
      : null,
    usagePct != null ? `Ejecución ${usagePct.toFixed(1)}%` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      title={title}
      className={cn(
        "min-w-[11.5rem] whitespace-nowrap rounded-md px-2 py-1 text-right",
        trafficLight ? TINT[trafficLight] : undefined,
      )}
    >
      <div className="flex items-baseline justify-end gap-1.5">
        {clickable ? (
          <button
            type="button"
            onClick={onSpendClick}
            className={cn(
              "text-[15px] font-bold tabular-nums tracking-tight hover:underline underline-offset-2",
              amountClass,
            )}
          >
            {spendLabel}
          </button>
        ) : (
          <div className={cn("text-[15px] font-bold tabular-nums tracking-tight", amountClass)}>
            {spendLabel}
          </div>
        )}
        {showBadge && trafficLight && usagePct != null && (
          <span className={cn("text-[11px] font-semibold tabular-nums", amountClass)}>
            {usagePct.toFixed(0)}%
          </span>
        )}
      </div>
      <div className="mt-0.5 text-[11px] leading-4 tabular-nums text-slate-500">
        <span className="text-slate-400">ppto</span>{" "}
        <span className="font-medium text-slate-600">{formatCurrency(budget)}</span>
      </div>
    </div>
  );
}
