"use client";

import Link from "next/link";
import { MessageSquare, UserCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TicketPriorityBadge, TicketStatusBadge } from "./TicketBadges";
import { relativeTime } from "@/modules/tickets-ti/services/ticket-serialize";

export type OperationTicket = {
  id: string;
  ticketNumber: string;
  title: string;
  category: string;
  priorityCode: string;
  statusCode: string;
  statusName: string;
  requesterName: string;
  assigneeName: string | null;
  lastActivityAt: string;
  slaRemaining: number | null;
};

export function TicketOperationCard({
  ticket,
  canManage,
  onAssign,
  onComment,
}: {
  ticket: OperationTicket;
  canManage: boolean;
  onAssign?: () => void;
  onComment?: () => void;
}) {
  return (
    <Card className="hover:border-indigo-200 transition-colors">
      <CardHeader className="pb-2 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={`/tickets-ti/${ticket.id}`} className="font-mono text-sm text-indigo-700 hover:underline">
            {ticket.ticketNumber}
          </Link>
          <TicketStatusBadge code={ticket.statusCode} name={ticket.statusName} />
        </div>
        <p className="text-xs text-slate-500">
          {ticket.category} · {ticket.requesterName} · {relativeTime(ticket.lastActivityAt)}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm font-medium text-slate-800 line-clamp-2">{ticket.title}</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <TicketPriorityBadge code={ticket.priorityCode} name={ticket.priorityCode} />
          {ticket.assigneeName ? (
            <span>Técnico: {ticket.assigneeName}</span>
          ) : (
            <span className="text-amber-700">Sin asignar</span>
          )}
          {ticket.slaRemaining != null && (
            <span className="tabular-nums">SLA: {ticket.slaRemaining} min</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1" asChild>
            <Link href={`/tickets-ti/${ticket.id}`}>
              <ArrowRight className="h-3.5 w-3.5" /> Abrir
            </Link>
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onComment} asChild>
            <Link href={`/tickets-ti/${ticket.id}?tab=comments`}>
              <MessageSquare className="h-3.5 w-3.5" /> Comentar
            </Link>
          </Button>
          {canManage && (
            <Button size="sm" variant="outline" className="h-8 gap-1" onClick={onAssign} asChild>
              <Link href={`/tickets-ti/${ticket.id}?tab=info`}>
                <UserCheck className="h-3.5 w-3.5" /> Asignar
              </Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
