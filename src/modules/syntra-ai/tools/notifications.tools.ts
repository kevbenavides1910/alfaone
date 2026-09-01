import {
  countUnreadInbox,
  listInboxNotifications,
} from "@/modules/notifications/services/notification-inbox";
import type { SyntraTool } from "./types";
import { toolDef } from "./types";
import { intArg } from "./shared";

export function notificationsTools(): SyntraTool[] {
  return [
    {
      permission: { key: "core.notifications", level: "view" },
      definition: toolDef(
        "list_inbox_notifications",
        "Notificaciones del usuario (bandeja de entrada).",
        {
          type: "object",
          properties: {
            limit: { type: "integer" },
          },
          additionalProperties: false,
        },
      ),
      describeCall: () => "Consultando notificaciones…",
      handler: async (session, args) => {
        const limit = intArg(args, "limit", 15, 30);
        const [items, unread] = await Promise.all([
          listInboxNotifications(session.user.id, limit),
          countUnreadInbox(session.user.id),
        ]);
        return {
          noLeidas: unread,
          notificaciones: items.map((n) => ({
            id: n.id,
            titulo: n.title,
            modulo: n.moduleLabel,
            leida: n.status === "READ",
            prioridad: n.priority,
            href: n.href,
            createdAt: n.createdAt,
          })),
          fuente: "Centro de notificaciones",
        };
      },
    },
  ];
}
