"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { FingerDashboardStats } from "@/modules/finger-system/services/finger-dashboard";

type OdooPing = {
  ok: boolean;
  message: string;
  devices?: number;
  users?: number;
  punches?: number;
};

type Stats = FingerDashboardStats & { odoo?: OdooPing };

function Card({
  title,
  value,
  href,
  hint,
}: {
  title: string;
  value: string | number;
  href?: string;
  hint?: string;
}) {
  const body = (
    <div className="rounded-xl border bg-card p-4 hover:bg-muted/40 transition-colors">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function FingerDashboardView({ stats }: { stats: Stats }) {
  const odoo = stats.odoo;
  const odooOk = odoo?.ok === true;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Finger System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operación diaria de relojes ZK. Padrón y marcas desde Odoo
          {odooOk ? " · conectado" : " · sin Odoo (revise Configuración)"}.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          title="Relojes"
          value={odooOk ? (odoo?.devices ?? 0) : stats.devicesOnline + stats.devicesOffline}
          href="/finger-system/dispositivos"
          hint={odooOk ? "Odoo alfa_biometric" : `${stats.devicesOnline} en línea`}
        />
        <Card
          title="Usuarios"
          value={odooOk ? (odoo?.users ?? 0) : stats.employeesLinked}
          href="/finger-system/empleados"
          hint={odooOk ? "Padrón biométrico" : "Vínculos locales"}
        />
        <Card
          title="Marcas"
          value={odooOk ? (odoo?.punches ?? 0) : stats.punchesToday}
          href="/finger-system/marcas"
          hint={odooOk ? "Histórico Odoo" : "Marcas hoy (local)"}
        />
        <Card
          title="Relojes en línea"
          value={stats.devicesOnline}
          href="/finger-system/dispositivos"
          hint={`${stats.devicesOffline} desconectados`}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link href="/finger-system/dispositivos">Relojes</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/finger-system/empleados">Usuarios</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/finger-system/marcas">Marcas</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/finger-system/asistencia">Asistencia</Link>
        </Button>
      </div>
    </div>
  );
}
