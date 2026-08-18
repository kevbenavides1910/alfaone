import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { unauthorized, forbidden } from "@/lib/api/response";
import { hasPermission } from "@/lib/permissions/check";
import {
  listFingerPunchesAfter,
  listRecentFingerPunches,
} from "@/modules/finger-system/services/finger-live-punches";

/**
 * SSE de marcas recientes (poll cada 10s sobre cache PostgreSQL).
 * Las marcas en tiempo real desde relojes ZKTeco requieren Fase 5.1.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  if (!hasPermission(session, "fingerSystem.marcasEnVivo", "view")) return forbidden();

  const company = req.nextUrl.searchParams.get("company") ?? undefined;
  const encoder = new TextEncoder();
  const pollMs = 10_000;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("connected", { pollMs });

      let lastCheckTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const initial = await listRecentFingerPunches({ limit: 20, hoursBack: 24, company });
      if (initial.length > 0) {
        send("initial", { items: initial.reverse() });
        const latest = initial[0]?.checkTime;
        if (latest) lastCheckTime = new Date(latest);
      }

      const tick = async () => {
        if (req.signal.aborted) return;
        try {
          const fresh = await listFingerPunchesAfter(lastCheckTime, 100, company);
          if (fresh.length > 0) {
            send("punches", { items: fresh });
            lastCheckTime = new Date(fresh[fresh.length - 1]!.checkTime);
          }
          send("heartbeat", { at: new Date().toISOString() });
        } catch {
          send("error", { message: "Error al consultar marcas." });
        }
      };

      await tick();
      const interval = setInterval(tick, pollMs);
      req.signal.addEventListener("abort", () => {
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
