const ticketInclude = {
  category: true,
  priority: true,
  status: true,
  type: true,
  department: true,
  requester: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  slas: { orderBy: { createdAt: "desc" as const }, take: 1 },
} as const;

export { ticketInclude };

export type TicketRow = {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  categoryDetail: string | null;
  category: { code: string; name: string };
  priority: { code: string; name: string; colorToken: string };
  status: { code: string; name: string; colorToken: string; pausesSla: boolean };
  type: { code: string; name: string };
  department: { code: string; name: string } | null;
  requester: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
  solution: string | null;
  totalWorkMinutes: number;
  openedAt: string;
  assignedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  lastActivityAt: string;
  sla: {
    targetMinutes: number;
    elapsedMinutes: number;
    pausedMinutes: number;
    remainingMinutes: number;
    status: string;
  } | null;
};

export function serializeTicket(row: {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  categoryDetail: string | null;
  solution: string | null;
  totalWorkMinutes: number;
  openedAt: Date;
  assignedAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  lastActivityAt: Date;
  category: { code: string; name: string };
  priority: { code: string; name: string; colorToken: string };
  status: { code: string; name: string; colorToken: string; pausesSla: boolean };
  type: { code: string; name: string };
  department: { code: string; name: string } | null;
  requester: { id: string; name: string; email: string };
  assignedTo: { id: string; name: string; email: string } | null;
  slas?: {
    targetMinutes: number;
    elapsedMinutes: number;
    pausedMinutes: number;
    remainingMinutes: number;
    status: string;
  }[];
}): TicketRow {
  const sla = row.slas?.[0];
  return {
    id: row.id,
    ticketNumber: row.ticketNumber,
    title: row.title,
    description: row.description,
    categoryDetail: row.categoryDetail ?? null,
    category: row.category,
    priority: row.priority,
    status: row.status,
    type: row.type,
    department: row.department,
    requester: row.requester,
    assignedTo: row.assignedTo,
    solution: row.solution,
    totalWorkMinutes: row.totalWorkMinutes,
    openedAt: row.openedAt.toISOString(),
    assignedAt: row.assignedAt?.toISOString() ?? null,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    closedAt: row.closedAt?.toISOString() ?? null,
    lastActivityAt: row.lastActivityAt.toISOString(),
    sla: sla
      ? {
          targetMinutes: sla.targetMinutes,
          elapsedMinutes: sla.elapsedMinutes,
          pausedMinutes: sla.pausedMinutes,
          remainingMinutes: sla.remainingMinutes,
          status: sla.status,
        }
      : null,
  };
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Hace un momento";
  if (mins < 60) return `Hace ${mins} minuto${mins === 1 ? "" : "s"}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Hace ${hours} hora${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `Hace ${days} día${days === 1 ? "" : "s"}`;
}
