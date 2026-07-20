"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Bell,
  CheckCheck,
  ExternalLink,
  History,
  Settings,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";
import type { NotificationListItem } from "@/modules/notifications";
import {
  notificationIcon,
  PRIORITY_STYLES,
  statusLabel,
} from "@/components/notifications/notification-display";

export function NotificationCenterBell() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<{ data: { items: NotificationListItem[]; unread: number } }>({
    queryKey: ["notification-center"],
    queryFn: async () => {
      const r = await fetch("/api/notifications");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const es = new EventSource("/api/notifications/stream");
    es.addEventListener("unread", () => {
      qc.invalidateQueries({ queryKey: ["notification-center"] });
    });
    return () => es.close();
  }, [qc]);

  const markAll = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/notifications", { method: "POST" });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-center"] }),
  });

  const patchOne = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: string }) => {
      const r = await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-center"] }),
  });

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const items = data?.data?.items ?? [];
  const unread = data?.data?.unread ?? 0;

  const openNotification = async (n: NotificationListItem) => {
    if (n.status === "UNREAD") {
      await patchOne.mutateAsync({ id: n.id, action: "read" });
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Centro de notificaciones"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative flex items-center justify-center h-8 w-8 rounded-md transition-colors",
          "text-muted-foreground hover:text-foreground hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
        )}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-2 z-50 w-[min(92vw,380px)] overflow-hidden rounded-xl border shadow-xl",
            "border-border bg-card text-card-foreground",
            "animate-in fade-in slide-in-from-top-2 duration-200",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
            <span className="text-sm font-semibold">Notificaciones</span>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => markAll.mutate()}
                >
                  <CheckCheck className="mr-1 h-3.5 w-3.5" />
                  Leídas
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href="/notificaciones/historial" onClick={() => setOpen(false)}>
                  <History className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                <Link href="/notificaciones/preferencias" onClick={() => setOpen(false)}>
                  <Settings className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="max-h-[min(70vh,420px)] overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">
                Sin notificaciones recientes
              </p>
            ) : (
              <ul>
                {items.map((n) => {
                  const Icon = notificationIcon(n.icon);
                  const pri = PRIORITY_STYLES[n.priority];
                  return (
                    <li
                      key={n.id}
                      className="border-b border-border/60 last:border-0"
                    >
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        className={cn(
                          "flex w-full gap-3 px-3 py-3 text-left transition-colors hover:bg-muted/60",
                          n.status === "UNREAD" && "bg-red-50/40 dark:bg-red-950/20",
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            pri.badge,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium leading-snug">{n.title}</p>
                            <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", pri.dot)} />
                          </div>
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {n.body}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                            <span className="rounded bg-muted px-1.5 py-0.5">{n.moduleLabel}</span>
                            <span>{statusLabel(n.status)}</span>
                            <span>{formatDate(n.createdAt)}</span>
                          </div>
                        </div>
                      </button>
                      <div className="flex justify-end gap-1 px-3 pb-2">
                        {n.href && (
                          <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" asChild>
                            <Link href={n.href} onClick={() => setOpen(false)}>
                              <ExternalLink className="mr-1 h-3 w-3" />
                              Abrir
                            </Link>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => patchOne.mutate({ id: n.id, action: "archive" })}
                        >
                          <Archive className="mr-1 h-3 w-3" />
                          Archivar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-red-600"
                          onClick={() => patchOne.mutate({ id: n.id, action: "delete" })}
                        >
                          <Trash2 className="mr-1 h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
