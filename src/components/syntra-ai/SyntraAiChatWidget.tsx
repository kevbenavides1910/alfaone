"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Brain,
  History,
  Minimize2,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";

type ChatTurn = { role: "user" | "assistant"; content: string };

type SessionRow = {
  id: string;
  name: string;
  pagePath: string | null;
  messageCount: number;
  updatedAt: string;
};

type SkillRow = {
  id: string;
  name: string;
  description: string;
  scope: string;
  authorName: string | null;
};

type MemoryRow = {
  id: string;
  title: string;
  content: string;
  scope: string;
  category: string;
  authorName: string | null;
};

type ViewMode = "chat" | "skills" | "memory";

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat("es-CR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function SyntraAiChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [skillsPersonal, setSkillsPersonal] = useState<SkillRow[]>([]);
  const [skillsTeam, setSkillsTeam] = useState<SkillRow[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [memoriesPersonal, setMemoriesPersonal] = useState<MemoryRow[]>([]);
  const [memoriesTeam, setMemoriesTeam] = useState<MemoryRow[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading, viewMode]);

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

  const refreshSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await fetch("/api/syntra-ai/sessions");
      const json = (await res.json()) as { data?: { sessions?: SessionRow[] } };
      if (res.ok) setSessions(json.data?.sessions ?? []);
    } finally {
      setSessionsLoading(false);
    }
  }, []);

  const refreshSkills = useCallback(async () => {
    setSkillsLoading(true);
    try {
      const res = await fetch("/api/syntra-ai/skills");
      const json = (await res.json()) as {
        data?: { personal?: SkillRow[]; team?: SkillRow[] };
      };
      if (res.ok) {
        setSkillsPersonal(json.data?.personal ?? []);
        setSkillsTeam(json.data?.team ?? []);
      }
    } finally {
      setSkillsLoading(false);
    }
  }, []);

  const refreshMemories = useCallback(async () => {
    setMemoriesLoading(true);
    try {
      const res = await fetch("/api/syntra-ai/memories");
      const json = (await res.json()) as {
        data?: { personal?: MemoryRow[]; team?: MemoryRow[] };
      };
      if (res.ok) {
        setMemoriesPersonal(json.data?.personal ?? []);
        setMemoriesTeam(json.data?.team ?? []);
      }
    } finally {
      setMemoriesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshSessions();
    void refreshSkills();
    void refreshMemories();
  }, [open, refreshSessions, refreshSkills, refreshMemories]);

  const loadSession = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/syntra-ai/sessions?sessionId=${encodeURIComponent(id)}`);
      const json = (await res.json()) as {
        data?: {
          session?: { id: string; name: string };
          messages?: Array<{ role: string; content: string }>;
        };
        error?: { message?: string };
      };
      if (!res.ok) throw new Error(json.error?.message || "No se pudo cargar la conversación");
      setSessionId(json.data?.session?.id ?? id);
      setSessionName(json.data?.session?.name ?? "");
      setHistory(
        (json.data?.messages ?? [])
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      );
      setViewMode("chat");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  const newSession = useCallback(() => {
    setSessionId(null);
    setSessionName("");
    setHistory([]);
    setError(null);
    setViewMode("chat");
  }, []);

  const deleteSession = useCallback(
    async (id: string, ev?: React.MouseEvent) => {
      ev?.stopPropagation();
      if (!confirm("¿Eliminar esta conversación?")) return;
      const res = await fetch(`/api/syntra-ai/sessions?sessionId=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      if (sessionId === id) newSession();
      void refreshSessions();
    },
    [newSession, refreshSessions, sessionId],
  );

  const useSkill = useCallback((skill: SkillRow) => {
    setInput(
      `Usa la habilidad «${skill.name}» (${skill.description}). Sigue su procedimiento y ayúdame con lo que tengo en pantalla.`,
    );
    setViewMode("chat");
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
        data?: { reply: string; sessionId: string; sessionName?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        throw new Error(json.error?.message || "Error al consultar al asistente");
      }
      const reply = json.data?.reply || "";
      if (json.data?.sessionId) setSessionId(json.data.sessionId);
      if (json.data?.sessionName) setSessionName(json.data.sessionName);
      setHistory((h) => [...h, { role: "assistant", content: reply }]);
      void refreshSessions();
      if (/recuerda|aprende|olvida|remember|learn/i.test(message)) {
        void refreshMemories();
        void refreshSkills();
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Error de red";
      setError(msg);
      setHistory((h) => h.slice(0, -1));
    } finally {
      setLoading(false);
    }
  }, [history, input, loading, pathname, refreshMemories, refreshSessions, refreshSkills, sessionId]);

  if (available === false) return null;

  const panelWidth = historyOpen && !minimized ? "w-[min(52rem,calc(100vw-1.5rem))]" : "w-[min(26rem,calc(100vw-1.5rem))]";

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
            "fixed z-50 flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl bottom-5 right-5",
            minimized ? "h-12 w-72" : cn("h-[34rem]", panelWidth),
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2 bg-indigo-600 text-white rounded-t-xl shrink-0">
            <div className="flex items-center gap-2 text-sm font-medium min-w-0">
              <Bot className="h-4 w-4 shrink-0" />
              <span className="truncate">{sessionName || "Syntra IA"}</span>
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
            <div className="flex flex-1 min-h-0">
              {historyOpen ? (
                <aside className="w-44 shrink-0 border-r border-slate-100 flex flex-col bg-slate-50/80">
                  <div className="p-2 border-b border-slate-100">
                    <button
                      type="button"
                      onClick={newSession}
                      className="flex w-full items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Nueva
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {sessionsLoading ? (
                      <p className="p-2 text-xs text-slate-400">Cargando…</p>
                    ) : sessions.length === 0 ? (
                      <p className="p-2 text-xs text-slate-500 leading-snug">
                        Sin conversaciones. Solo usted ve su historial.
                      </p>
                    ) : (
                      sessions.map((s) => (
                        <div
                          key={s.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => void loadSession(s.id)}
                          onKeyDown={(e) => e.key === "Enter" && void loadSession(s.id)}
                          className={cn(
                            "group flex items-start gap-1 px-2 py-2 cursor-pointer border-b border-slate-100/80 hover:bg-white",
                            sessionId === s.id && "bg-white ring-1 ring-inset ring-indigo-200",
                          )}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-medium text-slate-800">{s.name}</div>
                            <div className="text-[10px] text-slate-400">{formatWhen(s.updatedAt)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => void deleteSession(s.id, e)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-red-500 hover:text-red-700"
                            aria-label="Eliminar conversación"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </aside>
              ) : null}

              <div className="flex flex-1 flex-col min-w-0">
                <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-2 py-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setHistoryOpen((v) => !v)}
                    className={cn(
                      "rounded px-2 py-1 text-xs",
                      historyOpen ? "bg-slate-200 text-slate-800" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    <History className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                    Historial
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("chat");
                      void refreshSessions();
                    }}
                    className={cn(
                      "rounded px-2 py-1 text-xs",
                      viewMode === "chat" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("skills");
                      void refreshSkills();
                    }}
                    className={cn(
                      "rounded px-2 py-1 text-xs",
                      viewMode === "skills" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    <Sparkles className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                    Skills
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setViewMode("memory");
                      void refreshMemories();
                    }}
                    className={cn(
                      "rounded px-2 py-1 text-xs",
                      viewMode === "memory" ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    )}
                  >
                    <Brain className="inline h-3.5 w-3.5 mr-1 -mt-0.5" />
                    Memoria
                  </button>
                </div>

                {viewMode === "chat" ? (
                  <>
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 text-sm">
                      {history.length === 0 ? (
                        <p className="text-slate-500 text-xs leading-relaxed">
                          Pregúntame sobre Alfa One. Comandos: «recuerda para el equipo: …» (compartido),
                          «recuerda …» (solo usted), «aprende …» (skill de equipo), «olvida …».
                        </p>
                      ) : null}
                      {history.map((turn, i) => (
                        <div
                          key={`${turn.role}-${i}`}
                          className={cn(
                            "rounded-lg px-3 py-2 whitespace-pre-wrap text-sm",
                            turn.role === "user"
                              ? "ml-4 bg-indigo-50 text-slate-800"
                              : "mr-4 bg-slate-50 text-slate-700",
                          )}
                        >
                          {turn.content}
                        </div>
                      ))}
                      {loading ? <p className="text-slate-400 text-xs">Pensando…</p> : null}
                      {error ? <p className="text-red-600 text-xs">{error}</p> : null}
                      <div ref={bottomRef} />
                    </div>
                    <div className="border-t border-slate-100 p-2 flex gap-2 shrink-0">
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

                {viewMode === "skills" ? (
                  <div className="flex-1 overflow-y-auto p-3 text-sm space-y-4">
                    {skillsLoading ? (
                      <p className="text-xs text-slate-400">Cargando skills…</p>
                    ) : (
                      <>
                        <section>
                          <h3 className="text-xs font-semibold text-slate-700 mb-1">
                            Individuales <span className="text-slate-400">({skillsPersonal.length})</span>
                          </h3>
                          {skillsPersonal.length === 0 ? (
                            <p className="text-xs text-slate-500">«aprende … solo para mí» en el chat.</p>
                          ) : (
                            <div className="space-y-1">
                              {skillsPersonal.map((sk) => (
                                <button
                                  key={sk.id}
                                  type="button"
                                  onClick={() => useSkill(sk)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-indigo-300 hover:bg-indigo-50/50"
                                >
                                  <div className="font-medium text-slate-800">{sk.name}</div>
                                  <div className="text-xs text-slate-500">{sk.description}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </section>
                        <section>
                          <h3 className="text-xs font-semibold text-slate-700 mb-1">
                            Colectivas (equipo) <span className="text-slate-400">({skillsTeam.length})</span>
                          </h3>
                          {skillsTeam.length === 0 ? (
                            <p className="text-xs text-slate-500">«aprende …» en el chat (visible para todos).</p>
                          ) : (
                            <div className="space-y-1">
                              {skillsTeam.map((sk) => (
                                <button
                                  key={sk.id}
                                  type="button"
                                  onClick={() => useSkill(sk)}
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left hover:border-indigo-300 hover:bg-indigo-50/50"
                                >
                                  <div className="font-medium text-slate-800">{sk.name}</div>
                                  <div className="text-xs text-slate-500">{sk.description}</div>
                                  {sk.authorName ? (
                                    <div className="text-[10px] text-slate-400 mt-0.5">Autor: {sk.authorName}</div>
                                  ) : null}
                                </button>
                              ))}
                            </div>
                          )}
                        </section>
                      </>
                    )}
                  </div>
                ) : null}

                {viewMode === "memory" ? (
                  <div className="flex-1 overflow-y-auto p-3 text-sm space-y-4">
                    <p className="text-xs text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1.5">
                      Los hechos de <strong>equipo</strong> los ve y usa el asistente para <strong>todos</strong> los
                      usuarios de Alfa One. Los personales solo los ve usted.
                    </p>
                    {memoriesLoading ? (
                      <p className="text-xs text-slate-400">Cargando memoria…</p>
                    ) : (
                      <>
                        <section>
                          <h3 className="text-xs font-semibold text-slate-700 mb-1">
                            Equipo — compartida <span className="text-slate-400">({memoriesTeam.length})</span>
                          </h3>
                          {memoriesTeam.length === 0 ? (
                            <p className="text-xs text-slate-500">
                              «recuerda para el equipo: título: hecho» en el chat.
                            </p>
                          ) : (
                            <div className="space-y-1">
                              {memoriesTeam.map((m) => (
                                <div
                                  key={m.id}
                                  className="rounded-lg border border-indigo-100 bg-indigo-50/30 px-3 py-2"
                                >
                                  <div className="font-medium text-slate-800">{m.title}</div>
                                  <div className="text-xs text-slate-600 whitespace-pre-wrap">{m.content}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                        <section>
                          <h3 className="text-xs font-semibold text-slate-700 mb-1">
                            Personal <span className="text-slate-400">({memoriesPersonal.length})</span>
                          </h3>
                          {memoriesPersonal.length === 0 ? (
                            <p className="text-xs text-slate-500">«recuerda: …» en el chat (solo usted).</p>
                          ) : (
                            <div className="space-y-1">
                              {memoriesPersonal.map((m) => (
                                <div key={m.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                                  <div className="font-medium text-slate-800">{m.title}</div>
                                  <div className="text-xs text-slate-600 whitespace-pre-wrap">{m.content}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </section>
                      </>
                    )}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}
