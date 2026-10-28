import type { Session } from "next-auth";
import { prisma } from "@/modules/core/db/prisma";
import { hasPermission } from "@/lib/permissions/check";
import { buildFacturacionDashboard } from "@/modules/presupuestos/services/facturacion-dashboard";
import { listPagoProveedores } from "@/modules/pagos/services/pago-proveedores";
import { getTicketsDashboard } from "@/modules/tickets-ti/services/tickets-dashboard";
import { getDisciplinaryDashboard } from "@/modules/disciplinario/services/disciplinary-dashboard";

function parseMonth(month: string): { year: number; monthNum: number; from: Date; to: Date } {
  const [ys, ms] = month.split("-");
  const year = Number(ys);
  const monthNum = Number(ms);
  if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
    throw new Error("Mes inválido (use YYYY-MM)");
  }
  return {
    year,
    monthNum,
    from: new Date(Date.UTC(year, monthNum - 1, 1)),
    to: new Date(Date.UTC(year, monthNum, 1)),
  };
}

async function buildPagosInsights(from: Date, to: Date) {
  const [payments, queue] = await Promise.all([
    prisma.payment.findMany({
      where: { paymentDate: { gte: from, lt: to } },
      select: {
        amount: true,
        paid: true,
        source: true,
        confirmedForDaily: true,
      },
    }),
    listPagoProveedores(undefined, undefined, { includePaid: false }),
  ]);

  let scheduledAmount = 0;
  let paidAmount = 0;
  let unpaidAmount = 0;
  let paidCount = 0;
  let unpaidCount = 0;
  let scheduledCount = 0;

  for (const p of payments) {
    // Misma regla del diario: APEX solo si confirmado o ya pagado.
    if (p.source === "APEX" && !p.paid && !p.confirmedForDaily) continue;
    const amt = Number(p.amount);
    scheduledCount += 1;
    scheduledAmount += amt;
    if (p.paid) {
      paidAmount += amt;
      paidCount += 1;
    } else {
      unpaidAmount += amt;
      unpaidCount += 1;
    }
  }

  const unscheduled = queue.filter((q) => q.status === "unscheduled");
  const scheduledUnpaidQueue = queue.filter((q) => q.status === "scheduled_unpaid");

  const sum = (rows: { amount: number }[]) =>
    Math.round(rows.reduce((acc, r) => acc + r.amount, 0) * 100) / 100;

  return {
    calendar: {
      scheduledCount,
      scheduledAmount: Math.round(scheduledAmount * 100) / 100,
      paidCount,
      paidAmount: Math.round(paidAmount * 100) / 100,
      unpaidCount,
      unpaidAmount: Math.round(unpaidAmount * 100) / 100,
    },
    proveedores: {
      unscheduledCount: unscheduled.length,
      unscheduledAmount: sum(unscheduled),
      scheduledUnpaidCount: scheduledUnpaidQueue.length,
      scheduledUnpaidAmount: sum(scheduledUnpaidQueue),
    },
    href: "/pagos",
  };
}

/**
 * Paneles críticos de negocio para el Dashboard Ejecutivo.
 * Cada bloque se incluye solo si el usuario tiene permiso del módulo.
 */
export async function getExecutiveBusinessInsights(session: Session, month: string) {
  const { year, monthNum, from, to } = parseMonth(month);

  const canFacturacion = hasPermission(session, "facturacion.dashboard", "view");
  const canCxc = hasPermission(session, "facturacion.cxc", "view");
  const canPagos = hasPermission(session, "pagos.calendario", "view");
  const canTickets = hasPermission(session, "ticketsTi.centro", "view");
  const canDisciplinario = hasPermission(session, "disciplinario.dashboard", "view");

  const [facturacion, pagos, tickets, disciplinario] = await Promise.all([
    canFacturacion
      ? buildFacturacionDashboard(prisma, year).then((dash) => {
          const monthRow = dash.months[monthNum - 1];
          return {
            year,
            month,
            snapshot: canCxc ? dash.snapshot : null,
            monthTotals: {
              cxc: canCxc
                ? {
                    dueAmount: monthRow.cxc.dueAmount,
                    dueCount: monthRow.cxc.dueCount,
                    pendingAmount: monthRow.cxc.pendingAmount,
                    pendingCount: monthRow.cxc.pendingCount,
                    collectedOnTimeAmount: monthRow.cxc.collectedOnTimeAmount,
                    onTimeRate: monthRow.cxc.onTimeRate,
                  }
                : null,
              facturacion: {
                expectedAmount: monthRow.facturacion.expectedAmount,
                expectedCount: monthRow.facturacion.expectedCount,
                invoicedAmount: monthRow.facturacion.invoicedAmount,
                invoicedCount: monthRow.facturacion.invoicedCount,
                pendingInvoiceAmount: monthRow.facturacion.pendingInvoiceAmount,
                pendingInvoiceCount: monthRow.facturacion.pendingInvoiceCount,
                receivedConformeRate: monthRow.facturacion.receivedConformeRate,
              },
              ingresos: canCxc
                ? {
                    expectedInflowAmount: monthRow.ingresos.expectedInflowAmount,
                    actualInflowAmount: monthRow.ingresos.actualInflowAmount,
                    fulfillmentRate: monthRow.ingresos.fulfillmentRate,
                  }
                : null,
            },
            yearOnTimeRate: canCxc ? dash.totals.cxc.onTimeRate : null,
            href: "/facturacion/dashboard",
          };
        })
      : Promise.resolve(null),
    canPagos ? buildPagosInsights(from, to) : Promise.resolve(null),
    canTickets
      ? getTicketsDashboard(session, session.user.id).then((d) => ({
          active: d.counts.active,
          waitingUser: d.counts.waitingUser,
          overdueSla: d.counts.overdueSla,
          href: "/tickets-ti",
        }))
      : Promise.resolve(null),
    canDisciplinario
      ? getDisciplinaryDashboard({ desde: from, hasta: new Date(to.getTime() - 1) }).then((d) => ({
          totalApercibimientos: d.totales.apercibimientos,
          porEstado: d.porEstado,
          cobradosCount: d.totales.cobradosCount,
          cobradosMonto: d.totales.cobradosMonto,
          bajasCount: d.totales.bajas,
          tercerUmbralCount: d.totales.tercerosUmbral,
          href: "/disciplinario/dashboard",
        }))
      : Promise.resolve(null),
  ]);

  return {
    month,
    permissions: {
      facturacion: canFacturacion,
      cxc: canCxc,
      pagos: canPagos,
      tickets: canTickets,
      disciplinario: canDisciplinario,
    },
    facturacion,
    pagos,
    tickets,
    disciplinario,
  };
}

export type ExecutiveBusinessInsights = Awaited<ReturnType<typeof getExecutiveBusinessInsights>>;
