import type { NotificationPriority } from "@prisma/client";
import {
  AlertTriangle,
  Bell,
  CheckCircle,
  Info,
  MessageSquare,
  Ticket,
  type LucideIcon,
} from "lucide-react";

export const PRIORITY_STYLES: Record<
  NotificationPriority,
  { label: string; dot: string; badge: string }
> = {
  INFO: {
    label: "Información",
    dot: "bg-blue-500",
    badge: "bg-blue-50 text-blue-700 border-blue-200",
  },
  WARNING: {
    label: "Advertencia",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-800 border-amber-200",
  },
  ERROR: {
    label: "Error",
    dot: "bg-red-500",
    badge: "bg-red-50 text-red-700 border-red-200",
  },
  SUCCESS: {
    label: "Éxito",
    dot: "bg-emerald-500",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  URGENT: {
    label: "Urgente",
    dot: "bg-red-600 animate-pulse",
    badge: "bg-red-100 text-red-800 border-red-300",
  },
};

const ICON_MAP: Record<string, LucideIcon> = {
  ticket: Ticket,
  "message-square": MessageSquare,
  bell: Bell,
  "check-circle": CheckCircle,
  "alert-triangle": AlertTriangle,
};

export function notificationIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Bell;
  return ICON_MAP[name] ?? Info;
}

export function statusLabel(status: string): string {
  switch (status) {
    case "UNREAD":
      return "No leída";
    case "READ":
      return "Leída";
    case "ARCHIVED":
      return "Archivada";
    case "DELETED":
      return "Eliminada";
    default:
      return status;
  }
}
