"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bot,
  Brain,
  GripVertical,
  History,
  MapPin,
  Minimize2,
  Paperclip,
  Plus,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  formatPageContextLabel,
  resolvePageModuleLabel,
} from "@/modules/syntra-ai/business/page-context";
import { useSyntraFloatPosition } from "./use-syntra-float-position";
import { consumeSyntraChatStream } from "./syntra-chat-stream";

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

type PendingUpload = {
  id: string;
  name: string;
  mimetype: string;
  data: string;
  previewUrl?: string;
};

type ViewMode = "chat" | "skills" | "memory";

const FAB_SIZE = 48;
const MAX_UPLOADS = 4;
const MAX_UPLOAD_BYTES = 900 * 1024;

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

async function fileToUpload(file: File): Promise<PendingUpload> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`«${file.name}» supera ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB.`);
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  const b64 = btoa(binary);
  const mime = file.type || "application/octet-stream";
  const data = `data:${mime};base64,${b64}`;
  return {
    id: crypto.randomUUID(),
    name: file.name,
    mimetype: mime,
    data,
    previewUrl: mime.startsWith("image/") ? data : undefined,
  };
}

export function SyntraAiChatWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [input, setInput] = useState("");
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([]);
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
  const [thinkingText, setThinkingText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [pageTitle, setPageTitle] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pageContext = useMemo(
    () => ({
      path: pathname,
      pageTitle,
      moduleLabel: resolvePageModuleLabel(pathname),
    }),
    [pathname, pageTitle],
  );
  const pageLabel = formatPageContextLabel(pageContext);

  const panelWidthPx =
    typeof window !== "undefined"
      ? historyOpen && !minimized
        ? Math.min(832, window.innerWidth - 24)
        : Math.min(416, window.innerWidth - 24)
      : 416;
  const panelHeightPx =
    typeof window !== "undefined" ? (minimized ? 48 : Math.min(544, window.innerHeight - 24)) : 544;

  const fabPos = useSyntraFloatPosition("fab", FAB_SIZE, FAB_SIZE);
  const panelPos = useSyntraFloatPosition("panel", panelWidthPx, panelHeightPx);

  useEffect(() => {
    setPageTitle(typeof document !== "undefined" ? document.title : null);
  }, [pathname]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading, viewMode, thinkingText]);

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

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (!list.length) return;
    setError(null);
    const next: PendingUpload[] = [];
    for (const file of list) {
      if (pendingUploads.length + next.length >= MAX_UPLOADS) {
        setError(`Máximo ${MAX_UPLOADS} archivos por mensaje.`);
        break;
      }
      try {
        next.push(await fileToUpload(file));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Archivo no válido");
      }
    }
    if (next.length) setPendingUploads((u) => [...u, ...next].slice(0, MAX_UPLOADS));
  }, [pendingUploads.length]);

  const removeUpload = useCallback((id: string) => {
    setPendingUploads((u) => u.filter((x) => x.id !== id));
  }, []);

  const handlePaste = useCallback(
    (ev: React.ClipboardEvent) => {
      const items = ev.clipboardData?.items;
      if (!items?.length) return;
      const imageFiles: File[] = [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) imageFiles.push(f);
        }
      }
      if (imageFiles.length) {
        ev.preventDefault();
        void addFiles(imageFiles);
      }
    },
    [addFiles],
  );

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
    setPendingUploads([]);
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
    const uploads = pendingUploads;
    if ((!message && uploads.length === 0) || loading) return;

    const displayMessage =
      message ||
      (uploads.length ? `[${uploads.map((u) => u.name).join(", ")}]` : "");
    setInput("");
    setPendingUploads([]);
    setError(null);
    setLoading(true);
    setThinkingText("Iniciando…");
    setHistory((h) => [...h, { role: "user", content: displayMessage }]);

    try {
      const data = await consumeSyntraChatStream(
        {
          message: message || "",
          history,
          sessionId,
          pageContext,
          uploads: uploads.map((u) => ({
            name: u.name,
            mimetype: u.mimetype,
            data: u.data,
          })),
        },
        (text) => setThinkingText(text),
      );
      const reply = data.reply || "";
      if (data.sessionId) setSessionId(data.sessionId);
      if (data.sessionName) setSessionName(data.sessionName);
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
      setPendingUploads(uploads);
    } finally {
      setLoading(false);
      setThinkingText(null);
    }
  }, [history, input, loading, pageContext, pendingUploads, refreshMemories, refreshSessions, refreshSkills, sessionId]);

  if (available === false) return null;

  const panelWidthClass =
    historyOpen && !minimized ? "w-[min(52rem,calc(100vw-1.5rem))]" : "w-[min(26rem,calc(100vw-1.5rem))]";

  const fabStyle =
    fabPos.ready
      ? { left: fabPos.pos.left, top: fabPos.pos.top, right: "auto", bottom: "auto" as const }
      : { right: 20, bottom: 20, left: "auto" as const, top: "auto" as const };

  const panelStyle =
    panelPos.ready
      ? { left: panelPos.pos.left, top: panelPos.pos.top, right: "auto", bottom: "auto" as const }
      : { right: 20, bottom: 20, left: "auto" as const, top: "auto" as const };

  return (
    <>
      {!open ? (
        <button
          type="button"
          style={fabStyle}
          onPointerDown={fabPos.onPointerDown}
          onPointerMove={fabPos.onPointerMove}
          onPointerUp={(ev) => {
            const moved = fabPos.onPointerUp(ev);
            if (moved !== undefined && moved < 6) setOpen(true);
          }}
          className={cn(
            "fixed z-50 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 touch-none select-none",
            fabPos.dragging && "cursor-grabbing ring-2 ring-indigo-300",
          )}
          title="Asistente Syntra IA (arrastre para mover)"
          aria-label="Abrir asistente Syntra IA"
        >
          <Bot className="h-6 w-6 pointer-events-none" />
        </button>
      ) : (
        <div
          style={panelStyle}
          className={cn(
            "fixed z-50 flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl",
            minimized ? "h-12 w-72" : cn("h-[34rem]", panelWidthClass),
            panelPos.dragging && "ring-2 ring-indigo-300",
          )}
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-2 py-2 bg-indigo-600 text-white rounded-t-xl shrink-0">
            <div
              className="flex flex-1 items-center min-w-0 cursor-grab active:cursor-grabbing touch-none select-none"
              onPointerDown={panelPos.onPointerDown}
              onPointerMove={panelPos.onPointerMove}
              onPointerUp={panelPos.onPointerUp}
            >
              <GripVertical className="h-4 w-4 shrink-0 opacity-70 mr-1" aria-hidden />
              <div className="flex flex-col min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm font-medium min-w-0">
                  <Bot className="h-4 w-4 shrink-0" />
                  <span className="truncate">{sessionName || "Syntra IA"}</span>
                </div>
                {!minimized && pageLabel ? (
                  <div className="flex items-center gap-1 text-[10px] text-indigo-100 truncate mt-0.5">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate" title={pageLabel}>
                      {pageLabel}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setMinimized((m) => !m)}
                className="rounded p-1 hover:bg-indigo-500"
                aria-label={minimized ? "Expandir" : "Minimizar"}
              >
                <Minimize2 className="h-4 w-4" />
              </button>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
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
                          Pregúntame sobre Alfa One. Pegue imágenes o adjunte PDF/texto. Comandos: «recuerda para el
                          equipo: …», «recuerda …», «aprende …», «olvida …».
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
                      {loading && thinkingText ? (
                        <p className="text-indigo-600 text-xs flex items-center gap-2 animate-pulse">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" aria-hidden />
                          {thinkingText}
                        </p>
                      ) : null}
                      {error ? <p className="text-red-600 text-xs">{error}</p> : null}
                      <div ref={bottomRef} />
                    </div>
                    {pendingUploads.length ? (
                      <div className="border-t border-slate-100 px-2 py-1.5 flex flex-wrap gap-1 shrink-0">
                        {pendingUploads.map((u) => (
                          <span
                            key={u.id}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700"
                          >
                            {u.previewUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.previewUrl} alt="" className="h-4 w-4 rounded object-cover" />
                            ) : null}
                            <span className="max-w-[8rem] truncate">{u.name}</span>
                            <button
                              type="button"
                              onClick={() => removeUpload(u.id)}
                              className="text-slate-400 hover:text-red-600"
                              aria-label={`Quitar ${u.name}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="border-t border-slate-100 p-2 flex gap-2 shrink-0">
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept="image/*,.pdf,.txt,.json,.xml,text/*,application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) void addFiles(e.target.files);
                          e.target.value = "";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || pendingUploads.length >= MAX_UPLOADS}
                        className="self-end rounded-lg border border-slate-200 px-2 py-2 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        aria-label="Adjuntar archivo"
                        title="Imagen, PDF o texto (máx. 4)"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>
                      <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onPaste={handlePaste}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void send();
                          }
                        }}
                        rows={2}
                        placeholder="Escribe o pegue una imagen…"
                        className="flex-1 resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                      />
                      <button
                        type="button"
                        onClick={() => void send()}
                        disabled={loading || (!input.trim() && pendingUploads.length === 0)}
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
