"use client";

import { useRef } from "react";
import { Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import {
  TICKETS_ATTACHMENT_CONFIG,
  TICKET_ALLOWED_EXTENSIONS,
} from "@/modules/tickets-ti/config/tickets.config.client";

type Props = {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles: number;
  disabled?: boolean;
  label?: string;
  className?: string;
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function validateClientFile(file: File): string | null {
  const ext = file.name.includes(".") ? file.name.split(".").pop()?.toLowerCase() ?? "" : "";
  if (!ext || !TICKET_ALLOWED_EXTENSIONS.includes(ext as (typeof TICKET_ALLOWED_EXTENSIONS)[number])) {
    return `Extensión .${ext || "?"} no permitida`;
  }
  if (file.size > TICKETS_ATTACHMENT_CONFIG.maxFileBytes) {
    return `Máx. ${Math.round(TICKETS_ATTACHMENT_CONFIG.maxFileBytes / 1024 / 1024)} MB por archivo`;
  }
  return null;
}

export function TicketAttachmentPicker({
  files,
  onChange,
  maxFiles,
  disabled,
  label = "Archivos adjuntos",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  function addFiles(incoming: FileList | null) {
    if (!incoming?.length) return;
    const next = [...files];
    for (const file of Array.from(incoming)) {
      if (next.length >= maxFiles) break;
      const err = validateClientFile(file);
      if (err) {
        window.alert(`${file.name}: ${err}`);
        continue;
      }
      if (next.some((f) => f.name === file.name && f.size === file.size)) continue;
      next.push(file);
    }
    onChange(next);
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">
          ({files.length}/{maxFiles} · máx. {Math.round(TICKETS_ATTACHMENT_CONFIG.maxFileBytes / 1024 / 1024)} MB c/u)
        </span>
      </div>
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-2 text-sm text-slate-700 bg-slate-50 rounded px-2 py-1">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              <span className="truncate flex-1">{f.name}</span>
              <span className="text-xs text-slate-400 shrink-0">{formatBytes(f.size)}</span>
              <button
                type="button"
                className="text-slate-400 hover:text-red-600"
                disabled={disabled}
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                aria-label={`Quitar ${f.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled || files.length >= maxFiles}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1"
        disabled={disabled || files.length >= maxFiles}
        onClick={() => inputRef.current?.click()}
      >
        <Paperclip className="h-4 w-4" />
        Agregar archivos
      </Button>
    </div>
  );
}

export async function uploadTicketFiles(ticketId: string, files: File[], commentId?: string) {
  const results = [];
  for (const file of files) {
    const form = new FormData();
    form.append("file", file);
    if (commentId) form.append("commentId", commentId);
    const r = await fetch(`/api/tickets-ti/${ticketId}/attachments`, { method: "POST", body: form });
    const json = await r.json();
    if (json.error) throw new Error(json.error.message ?? "Error al subir archivo");
    results.push(json.data);
  }
  return results;
}
