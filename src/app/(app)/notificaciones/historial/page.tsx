"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, ExternalLink, RotateCcw } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/utils/format";
import type { NotificationHistoryItem } from "@/modules/notifications/business/types";
import {
  notificationIcon,
  PRIORITY_STYLES,
  statusLabel,
} from "@/components/notifications/notification-display";

export default function NotificationHistoryPage() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [moduleKey, setModuleKey] = useState("");
  const [priority, setPriority] = useState("");

  const queryKey = useMemo(
    () => ["notification-history", q, moduleKey, priority],
    [q, moduleKey, priority],
  );

  const { data, isLoading, refetch } = useQuery<{
    data: { items: NotificationHistoryItem[]; total: number };
  }>({
    queryKey,
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      if (moduleKey) sp.set("moduleKey", moduleKey);
      if (priority) sp.set("priority", priority);
      sp.set("limit", "100");
      const r = await fetch(`/api/notifications/history?${sp}`);
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const items = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;

  const restore = async (id: string) => {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "restore" }),
    });
    refetch();
  };

  return (
    <>
      <Topbar title="Historial de notificaciones" />
      <div className="mx-auto max-w-5xl space-y-6 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <Bell className="h-7 w-7 text-red-600" />
              Historial de notificaciones
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Registro permanente. Las notificaciones salen de la bandeja a los 3 días pero
              permanecen aquí.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/notificaciones/preferencias">Preferencias</Link>
          </Button>
        </div>

        <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-3">
          <Input
            placeholder="Buscar título o texto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Input
            placeholder="Módulo (ej. ticketsTi)"
            value={moduleKey}
            onChange={(e) => setModuleKey(e.target.value)}
          />
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value="">Todas las prioridades</option>
            <option value="INFO">Información</option>
            <option value="WARNING">Advertencia</option>
            <option value="ERROR">Error</option>
            <option value="SUCCESS">Éxito</option>
            <option value="URGENT">Urgente</option>
          </select>
        </div>

        <p className="text-sm text-muted-foreground">{total} registros</p>

        {isLoading ? (
          <p className="text-muted-foreground">Cargando historial…</p>
        ) : items.length === 0 ? (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Sin registros en el historial
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((n) => {
              const Icon = notificationIcon(n.icon);
              const pri = PRIORITY_STYLES[n.priority];
              return (
                <li
                  key={n.id}
                  className="rounded-xl border border-border bg-card p-4 transition hover:shadow-sm"
                >
                  <div className="flex gap-3">
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${pri.badge}`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{n.title}</h2>
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px]">
                          {n.moduleLabel}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {statusLabel(n.status)}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        Creada {formatDate(n.createdAt)} · Archivada{" "}
                        {formatDate(n.movedAt)}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {n.href && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() => router.push(n.href!)}
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            Abrir elemento
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 gap-1"
                          onClick={() => restore(n.id)}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Restaurar a bandeja
                        </Button>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
