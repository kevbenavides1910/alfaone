"use client";

import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/lib/impersonation/context";

export function ImpersonationBanner() {
  const { isImpersonating, roleCode, clear } = useImpersonation();

  if (!isImpersonating || !roleCode) return null;

  function exitImpersonation() {
    clear();
    window.close();
    // Si el navegador no permite cerrar la pestaña (no fue abierta por script), volver a roles.
    window.setTimeout(() => {
      window.location.href = "/admin/roles";
    }, 200);
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Eye className="h-4 w-4 shrink-0 text-amber-700" />
        <span>
          Viendo la plataforma como el rol{" "}
          <strong className="font-semibold">{roleCode}</strong> (vista previa en esta pestaña).
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-400 bg-white hover:bg-amber-100"
        onClick={() => exitImpersonation()}
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Salir de vista previa
      </Button>
    </div>
  );
}
