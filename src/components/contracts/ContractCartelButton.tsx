"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, FileUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

type Props = {
  contractId: string;
  fileName?: string | null;
  canEdit: boolean;
};

/**
 * Botón para cargar y ver el cartel de la licitación del contrato.
 * Se muestra en el encabezado del detalle del contrato.
 */
export function ContractCartelButton({ contractId, fileName, canEdit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const queryClient = useQueryClient();
  const api = `/api/contracts/${contractId}/cartel`;

  async function subir(file: File) {
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const r = await fetch(api, { method: "POST", body: fd });
      const j = (await r.json().catch(() => null)) as { error?: string } | null;
      if (!r.ok) throw new Error(j?.error ?? "No se pudo cargar el cartel");
      toast.success("Cartel cargado", file.name);
      await queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
    } catch (e) {
      toast.error("Error al cargar el cartel", (e as Error).message);
    } finally {
      setSubiendo(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function quitar() {
    if (!confirm("¿Quitar el cartel de este contrato?")) return;
    setSubiendo(true);
    try {
      const r = await fetch(api, { method: "DELETE" });
      if (!r.ok) throw new Error("No se pudo quitar el cartel");
      toast.success("Cartel quitado");
      await queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
    } catch (e) {
      toast.error("Error al quitar el cartel", (e as Error).message);
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void subir(f);
        }}
      />
      {fileName ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-sm border-[#c6c6c6] bg-white shadow-none hover:bg-[#e8e8e8]"
          title={fileName}
          onClick={() => window.open(`${api}?file=1`, "_blank", "noopener,noreferrer")}
        >
          <Eye className="h-4 w-4" />
          Ver cartel
        </Button>
      ) : null}
      {canEdit && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-sm border-[#c6c6c6] bg-white shadow-none hover:bg-[#e8e8e8]"
          disabled={subiendo}
          title={fileName ? "Reemplazar el cartel" : "Cargar el cartel de la licitación"}
          onClick={() => inputRef.current?.click()}
        >
          <FileUp className="h-4 w-4" />
          {fileName ? "Reemplazar cartel" : "Cargar cartel"}
        </Button>
      )}
      {canEdit && fileName ? (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 rounded-sm border-[#da1e28] bg-white text-[#da1e28] shadow-none hover:bg-[#fff1f1]"
          disabled={subiendo}
          onClick={() => void quitar()}
        >
          <Trash2 className="h-4 w-4" />
          Quitar cartel
        </Button>
      ) : null}
    </>
  );
}
