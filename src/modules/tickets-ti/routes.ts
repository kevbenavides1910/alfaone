import type { Session } from "next-auth";
import { hasPermission } from "@/lib/permissions/check";

/** Ruta de entrada al módulo según rol: operaciones vs. solo crear ticket. */
export function ticketsTiEntryPath(session: Session | null): string {
  if (hasPermission(session, "ticketsTi.centro", "view")) return "/tickets-ti";
  return "/tickets-ti/mis-tickets";
}

export function ticketsTiBackPath(session: Session | null): string {
  return ticketsTiEntryPath(session);
}
