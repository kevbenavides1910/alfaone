"use client";

import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function CopyTextButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast.success("Copiado al portapapeles");
        } catch {
          toast.error("No se pudo copiar");
        }
      }}
    >
      <Copy className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}
