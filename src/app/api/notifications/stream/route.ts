import { NextRequest } from "next/server";
import { getSession } from "@/lib/api/middleware";
import { ok, unauthorized } from "@/lib/api/response";
import { countUnreadInbox } from "@/modules/notifications";

/**
 * SSE preparado para tiempo real (activar con Reverb/Pusher después).
 * Hoy: heartbeat + contador unread cada 30s.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      send("connected", { userId: session.user.id });

      const tick = async () => {
        if (req.signal.aborted) return;
        const unread = await countUnreadInbox(session.user.id);
        send("unread", { unread });
      };

      await tick();
      const interval = setInterval(tick, 30_000);
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
