"use client";

import { useSession } from "next-auth/react";
import { Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useImpersonation } from "@/lib/impersonation/context";

export function ImpersonationBanner() {
  const { data: session, update } = useSession();
  const { clear } = useImpersonation();

  const roleId = session?.user?.impersonatedRoleId;
  const roleCode = session?.user?.impersonatedRoleCode;

  if (!roleId || !roleCode) return null;

  async function exitImpersonation() {
    clear();
    await update({ clearImpersonation: true });
    window.location.href = "/admin/roles";
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        <Eye className="h-4 w-4 shrink-0 text-amber-700" />
        <span>
          Viendo la plataforma como el rol{" "}
          <strong className="font-semibold">{roleCode}</strong> (solo lectura de menús y permisos
          asignados).
        </span>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="shrink-0 border-amber-400 bg-white hover:bg-amber-100"
        onClick={() => void exitImpersonation()}
      >
        <X className="h-3.5 w-3.5 mr-1" />
        Salir de vista previa
      </Button>
    </div>
  );
}
