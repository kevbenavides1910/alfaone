/**
 * Reporte mensual de gasto.
 * Pagado = marcado en verde. Proyectado = programado en el diario y aún no pagado.
 * Avance = pagado / (pagado + proyectado).
 * APEX entra solo si ya está en verde o confirmado para el diario.
 */

export function isDailyCalendarPayment(p: {
  source: string;
  paid: boolean;
  confirmedForDaily?: boolean;
}): boolean {
  return p.source !== "APEX" || p.paid || Boolean(p.confirmedForDaily);
}

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function spendProgressPct(paid: number, projected: number): number {
  const total = paid + projected;
  if (total <= 0) return 0;
  return Math.min(100, Math.round((paid / total) * 100));
}

export function monthlySpendSplit(
  payments: {
    amount: number;
    paid: boolean;
    source: string;
    confirmedForDaily?: boolean;
  }[],
) {
  let paid = 0;
  let projected = 0;
  let paidCount = 0;
  let projectedCount = 0;
  for (const p of payments) {
    if (!isDailyCalendarPayment(p)) continue;
    if (p.paid) {
      paid += p.amount;
      paidCount += 1;
    } else {
      projected += p.amount;
      projectedCount += 1;
    }
  }
  paid = roundMoney(paid);
  projected = roundMoney(projected);
  return {
    paid,
    projected,
    total: roundMoney(paid + projected),
    avancePct: spendProgressPct(paid, projected),
    paidCount,
    projectedCount,
  };
}
