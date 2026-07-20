import type {
  NotificationPriority,
  NotificationStatus,
} from "@prisma/client";

export type NotificationEventPayload = {
  typeCode: string;
  title: string;
  body: string;
  moduleKey: string;
  entityType?: string | null;
  entityId?: string | null;
  href?: string | null;
  priority?: NotificationPriority;
  metadata?: Record<string, unknown> | null;
  /** Destinatarios explícitos (p. ej. asignado, solicitante). */
  recipientUserIds?: string[];
  actorUserId?: string | null;
  actorIp?: string | null;
};

export type NotificationListItem = {
  id: string;
  title: string;
  body: string;
  moduleKey: string;
  moduleLabel: string;
  typeCode: string;
  typeLabel: string;
  entityType: string | null;
  entityId: string | null;
  href: string | null;
  priority: NotificationPriority;
  status: NotificationStatus;
  readAt: string | null;
  createdAt: string;
  icon: string | null;
};

export type NotificationHistoryItem = NotificationListItem & {
  movedAt: string;
  archivedAt: string | null;
};

export type NotificationPreferenceItem = {
  typeId: string;
  typeCode: string;
  label: string;
  moduleKey: string;
  description: string | null;
  enabled: boolean;
  canDisable: boolean;
};

export const INBOX_RETENTION_DAYS = 3;

export const MODULE_LABELS: Record<string, string> = {
  core: "Plataforma",
  ticketsTi: "Tickets TI",
  inventario: "Inventario",
  presupuestos: "Contratos",
  disciplinario: "Disciplinario",
  empleados: "Empleados",
  sig: "SIG",
  recorridos: "Recorridos",
  plataforma: "Administración",
};
