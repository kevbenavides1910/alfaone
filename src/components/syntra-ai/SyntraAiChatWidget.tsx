"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, Minimize2, Send, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ChatTurn = { role: "user" | "assistant"; content: string };

export function SyntraAiChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  useEffect(() => {
    fetch("/api/syntra-ai/status")
      .then(async (r) => {
        if (!r.ok) {
          setAvailable(false);
          return;
        }
        const json = (await r.json()) as { data?: { enabled?: boolean } };
        setAvailable(Boolean(json.data?.enabled));
      })
      .catch(() => setAvailable(false));
  }, []);

  const send = useCallback(async () => {
    const message = input.trim();
    if (!message || loading) return;

    setInput("");
    setError(null);
    setLoading(true);
    setHistory((h) => [...h, { role: "user", content: message }]);

    try {
      const res = await fetch("/api/syntra-ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          history,
          sessionId,
          pagePath: pathname,
        }),
      });
      const json = (await res.json()) as {
        data?: { reply: string; sessionId: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(json.error?.message || "Error al consultar al asistente");
      }
      const reply = json.data?.reply || "";
      if (json.data?.sessionId) setSessionId(json.data.sessionId);
      setHistory((h) => [...h, { role: "assistant", content: reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de red";
      setError(msg);
      setHistory((h) => h.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [history, input, loading, pathname, sessionId]);

  if (available === false) return null;

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700"
          title="Asistente Syntra IA"
          aria-label="Abrir asistente Syntra IA"
        >
          <Bot className="h-6 w-6" />
        </button>
      ) : (
        <div
          className={cn(
            "fixed z-50 flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl",
            minimized ? "bottom-5 right-5 h-12 w-72" : "bottom-5 right-5 h-[32rem] w-[26rem] max-w-[calc(100vw-2rem)]",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 bg-indigo-600 text-white rounded-t-xl">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Bot className="h-4 w-4" />
              Syntra IA
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMinimized((m) => !m)}
                className="rounded p-1 hover:bg-indigo-500"
                aria-label={minimized ? "Expandir" : "Minimizar"}
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded p-1 hover:bg-indigo-500"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!minimized ? (
            <>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
                {history.length === 0 ? (
                  <p className="text-slate-500">
                    Pregúntame sobre Alfa One: contratos, gastos, facturación, nómina…
                    También puedes decir «recuerda …» o «aprende …».
                  </p>
                ) : null}
                {history.map((turn, i) => (
                  <div
                    key={`${turn.role}-${i}`}
                    className={cn(
                      "rounded-lg px-3 py-2 whitespace-pre-wrap",
                      turn.role === "user"
                        ? "ml-6 bg-indigo-50 text-slate-800"
                        : "mr-6 bg-slate-50 text-slate-700",
                    )}
                  >
                    {turn.content}
                  </div>
                ))}
                {loading ? <p className="text-slate-400 text-xs">Pensando…</p> : null}
                {error ? <p className="text-red-600 text-xs">{error}</p> : null}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-slate-100 p-2 flex gap-2">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  placeholder="Escribe tu pregunta…"
                  className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={loading || !input.trim()}
                  className="self-end rounded-lg bg-indigo-600 px-3 py-2 text-white disabled:opacity-50 hover:bg-indigo-700"
                  aria-label="Enviar"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}
