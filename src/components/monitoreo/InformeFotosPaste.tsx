"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";
import { cn } from "@/lib/utils/cn";

export type InformeFoto = {
  url: string;
  fileName: string;
  mimeType: string;
  /** Local preview while uploading / before save */
  previewUrl?: string;
};

type Props = {
  value: InformeFoto[];
  onChange: (fotos: InformeFoto[]) => void;
  max?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
};

async function uploadFile(file: File): Promise<InformeFoto> {
  const form = new FormData();
  form.append("file", file);
  const r = await fetch("/api/monitoreo/imagenes", { method: "POST", body: form });
  const json = await r.json();
  if (!r.ok) throw new Error(json.error?.message ?? "No se pudo subir la imagen");
  return json.data as InformeFoto;
}

export function InformeFotosPaste({
  value,
  onChange,
  max = 6,
  disabled,
  className,
  label = "Fotos del informe",
}: Props) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [focused, setFocused] = useState(false);

  const addFiles = useCallback(
    async (files: File[]) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (!images.length) {
        toast.error("Pegá o seleccioná una imagen");
        return;
      }
      const room = max - value.length;
      if (room <= 0) {
        toast.error(`Máximo ${max} fotos`);
        return;
      }
      const slice = images.slice(0, room);
      setUploading(true);
      try {
        const uploaded: InformeFoto[] = [];
        for (const file of slice) {
          const saved = await uploadFile(file);
          uploaded.push({ ...saved, previewUrl: URL.createObjectURL(file) });
        }
        onChange([...value, ...uploaded]);
        toast.success(uploaded.length === 1 ? "Foto agregada" : `${uploaded.length} fotos agregadas`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Error al subir");
      } finally {
        setUploading(false);
      }
    },
    [max, onChange, value],
  );

  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      if (disabled || uploading) return;
      const target = e.target as Node | null;
      const inZone = zoneRef.current && target && zoneRef.current.contains(target);
      // Also accept paste when zone is focused (tab) or document activeElement is inside zone
      const activeInZone =
        zoneRef.current &&
        document.activeElement &&
        zoneRef.current.contains(document.activeElement);
      if (!inZone && !activeInZone && !focused) return;

      const items = e.clipboardData?.items;
      if (!items) return;
      const files: File[] = [];
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const f = item.getAsFile();
          if (f) files.push(f);
        }
      }
      if (!files.length) return;
      e.preventDefault();
      void addFiles(files);
    }

    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addFiles, disabled, focused, uploading]);

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-slate-600">{label}</span>
        <span className="text-xs text-slate-400">
          Ctrl+V para pegar captura · {value.length}/{max}
        </span>
      </div>

      <div
        ref={zoneRef}
        tabIndex={0}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          if (disabled) return;
          void addFiles(Array.from(e.dataTransfer.files));
        }}
        className={cn(
          "rounded-md border border-dashed border-slate-300 bg-slate-50/80 p-3 outline-none transition",
          focused && "border-slate-500 ring-2 ring-slate-200",
          disabled && "opacity-60 pointer-events-none",
        )}
      >
        {value.length > 0 ? (
          <ul className="flex flex-wrap gap-2 mb-3">
            {value.map((foto) => (
              <li key={foto.fileName} className="relative group">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.previewUrl ?? foto.url}
                  alt=""
                  className="h-20 w-20 object-cover rounded border border-slate-200 bg-white"
                />
                <button
                  type="button"
                  className="absolute -top-1.5 -right-1.5 rounded-full bg-slate-800 text-white p-0.5 opacity-80 hover:opacity-100"
                  aria-label="Quitar foto"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((f) => f.fileName !== foto.fileName))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500 mb-2">
            Hacé clic aquí y pegá (Ctrl+V) una captura de pantalla, o elegí un archivo.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={disabled || uploading || value.length >= max}
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1"
            disabled={disabled || uploading || value.length >= max}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="h-4 w-4" />
            {uploading ? "Subiendo..." : "Elegir imagen"}
          </Button>
        </div>
      </div>
    </div>
  );
}
