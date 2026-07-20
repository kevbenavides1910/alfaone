"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@/lib/auth/client-session";
import { hasPermission } from "@/lib/permissions/check";
import { ticketsTiEntryPath } from "@/modules/tickets-ti/routes";
import TicketsTiCentroPage from "./CentroPage";

export default function TicketsTiPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const canCentro = hasPermission(session, "ticketsTi.centro", "view");

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!canCentro) {
      router.replace("/tickets-ti/mis-tickets");
    }
  }, [status, canCentro, router]);

  if (status === "loading" || !canCentro) {
    return <div className="p-6 text-slate-500">Cargando…</div>;
  }

  return <TicketsTiCentroPage />;
}
