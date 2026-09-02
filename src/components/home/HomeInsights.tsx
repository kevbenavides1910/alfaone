"use client";

import Link from "next/link";
import { AlertTriangle, BarChart3, ChevronRight, TrendingUp } from "lucide-react";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission, canAccessModuleFromSession } from "@/lib/permissions/check";

export function HomeInsights() {
  const { data: session } = useSession();
  const canContracts = hasPermission(session, "presupuestos.contracts", "view");
  const canDashboard =
    canAccessModuleFromSession(session, "presupuestos") ||
    hasPermission(session, "facturacion.cobro", "view") ||
    hasPermission(session, "facturacion.cxc", "view");

  if (!canContracts && !canDashboard) return null;

  return (
    <section className="mb-6 md:mb-8" aria-label="Resumen inteligente">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Resumen inteligente
        </h2>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          Accesos rápidos
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 md:gap-4">
        {canContracts && (
          <Link href="/contracts" className="home-insight group">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/45">
              <AlertTriangle
                className="h-5 w-5 text-[color:var(--app-primary)]"
                strokeWidth={1.75}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Contratos por revisar</p>
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60">
                  AI-SYS-01
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Revisa vencimientos y estado de licitaciones activas.
              </p>
              <span className="mt-2 inline-flex items-center gap-0.5 text-[11px] font-semibold text-[color:var(--app-primary)]">
                Revisar ahora
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        )}

        {canDashboard && (
          <Link href="/dashboard" className="home-insight group">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-950/40">
              <TrendingUp className="h-5 w-5 text-sky-600 dark:text-sky-400" strokeWidth={1.75} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">Dashboard ejecutivo</p>
                <span className="shrink-0 text-[10px] font-medium text-muted-foreground/60">
                  AI-SYS-02
                </span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                Semáforo de rentabilidad y métricas consolidadas.
              </p>
              <div className="mt-2.5 h-1.5 w-full max-w-[220px] overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full w-[72%] rounded-full bg-sky-500 dark:bg-sky-400"
                  aria-hidden
                />
              </div>
              <span className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                <BarChart3 className="h-3.5 w-3.5" />
                Ver métricas
              </span>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}
