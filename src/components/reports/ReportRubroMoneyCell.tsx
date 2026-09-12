"use client";

import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { TrafficLightBadge } from "@/components/shared/TrafficLightBadge";
import type { TrafficLight } from "@/lib/utils/constants";

const TINT: Record<TrafficLight, string> = {
  GREEN: "bg-emerald-50",
  YELLOW: "bg-amber-50",
  RED: "bg-red-50",
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

  return (
    <div
      className={cn(
        "min-w-[10.75rem] rounded-md px-2.5 py-1.5 text-right",
        trafficLight ? TINT[trafficLight] : undefined,
      )}
    >
      {showBadge && trafficLight && usagePct != null && (
        <div className="mb-1 flex justify-end">
          <TrafficLightBadge light={trafficLight} pct={usagePct} size="sm" />
        </div>
      )}
      {clickable ? (
        <button
          type="button"
          onClick={onSpendClick}
          className="block w-full text-right text-sm font-semibold tabular-nums tracking-tight text-slate-900 hover:text-blue-800 hover:underline underline-offset-2"
          title="Ver desglose de este gasto"
        >
          {spendLabel}
        </button>
      ) : (
        <div className="text-sm font-semibold tabular-nums tracking-tight text-slate-900">
          {spendLabel}
        </div>
      )}
      <div className="mt-0.5 text-[11px] leading-4 tabular-nums text-slate-600">
        <span className="text-slate-400">Ppto</span>{" "}
        <span className="font-medium text-slate-700">{formatCurrency(budget)}</span>
      </div>
      {(cargasSocialesSpend ?? 0) > 0 && (
        <div className="text-[11px] leading-4 tabular-nums text-amber-900">
          <span className="text-amber-700/90">Cargas</span>{" "}
          {formatCurrency(cargasSocialesSpend!)}
        </div>
      )}
    </div>
  );
}
