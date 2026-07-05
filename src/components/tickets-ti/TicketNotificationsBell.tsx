"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { formatDate } from "@/lib/utils/format";

type NotificationItem = {
  id: string;
  ticketId: string;
  ticketNumber: string;
  title: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  href: string;
};

export function TicketNotificationsBell() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery<{ data: { items: NotificationItem[]; unread: number } }>({
    queryKey: ["tickets-ti-notifications"],
    queryFn: async () => {
      const r = await fetch("/api/tickets-ti/notifications");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
    refetchInterval: 60_000,
  });

  const markAll = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/tickets-ti/notifications", { method: "POST" });
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets-ti-notifications"] }),
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

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Notificaciones Tickets TI"
        className="relative text-white hover:bg-white/10 hover:text-white"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white text-slate-900 shadow-xl z-50">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold">Notificaciones</span>
            {unread > 0 && (
              <button
                type="button"
                className="text-xs text-red-600 hover:underline"
                onClick={() => markAll.mutate()}
              >
                Marcar leídas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">Sin notificaciones</p>
          ) : (
            <ul>
              {items.map((n) => (
                <li key={n.id} className="border-b border-slate-50 last:border-0">
                  <Link
                    href={n.href}
                    className={cn(
                      "block px-3 py-2.5 hover:bg-slate-50",
                      !n.readAt && "bg-indigo-50/50"
                    )}
                    onClick={() => setOpen(false)}
                  >
                    <div className="text-xs font-mono text-indigo-700">{n.ticketNumber}</div>
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className="text-xs text-slate-500 line-clamp-2">{n.message}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">{formatDate(n.createdAt)}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
