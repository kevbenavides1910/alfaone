"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Headset, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { hasPermission } from "@/lib/permissions/check";
import { TicketPriorityBadge, TicketStatusBadge } from "@/components/tickets-ti/TicketBadges";
import { relativeTime } from "@/modules/tickets-ti/services/ticket-serialize";

type TicketRow = {
  id: string;
  ticketNumber: string;
  title: string;
  category: { name: string };
  priority: { code: string; name: string };
  status: { code: string; name: string };
  assignedTo: { name: string } | null;
  lastActivityAt: string;
  openedAt: string;
};

export default function MisTicketsPage() {
  const { data: session } = useSession();
  const canCreate = hasPermission(session, "ticketsTi.tickets", "edit");

  const { data, isLoading, error } = useQuery<{ data: TicketRow[] }>({
    queryKey: ["tickets-ti-mis-tickets"],
    queryFn: async () => {
      const r = await fetch("/api/tickets-ti?limit=100");
      const json = await r.json();
      if (json.error) throw new Error(json.error.message);
      return json;
    },
  });

  const tickets = data?.data ?? [];

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Headset className="h-7 w-7 text-indigo-600" />
            Mis tickets
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Solicitudes que usted ha creado y su estado de seguimiento.
          </p>
        </div>
        {canCreate && (
          <Button asChild className="gap-2">
            <Link href="/tickets-ti/nuevo">
              <Plus className="h-4 w-4" />
              Nuevo ticket
            </Link>
          </Button>
        )}
      </div>

      {isLoading && <p className="text-slate-500">Cargando sus tickets…</p>}
      {error && <p className="text-red-600">{(error as Error).message}</p>}

      {!isLoading && !error && tickets.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <p className="text-sm text-slate-500">Aún no tiene tickets registrados.</p>
            {canCreate && (
              <Button asChild size="sm" className="gap-1">
                <Link href="/tickets-ti/nuevo">
                  <Plus className="h-4 w-4" />
                  Crear su primer ticket
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <ul className="space-y-3">
        {tickets.map((ticket) => (
          <li key={ticket.id}>
            <Link href={`/tickets-ti/${ticket.id}`}>
              <Card className="hover:border-indigo-200 transition-colors">
                <CardContent className="py-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-sm text-indigo-700">{ticket.ticketNumber}</span>
                    <TicketStatusBadge code={ticket.status.code} name={ticket.status.name} />
                  </div>
                  <p className="text-sm font-medium text-slate-900 line-clamp-2">{ticket.title}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{ticket.category.name}</span>
                    <span>·</span>
                    <TicketPriorityBadge code={ticket.priority.code} name={ticket.priority.name} />
                    <span>·</span>
                    <span>{relativeTime(ticket.lastActivityAt)}</span>
                    {ticket.assignedTo && (
                      <>
                        <span>·</span>
                        <span>Técnico: {ticket.assignedTo.name}</span>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
