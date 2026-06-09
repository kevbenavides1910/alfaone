"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Topbar } from "@/components/layout/Topbar";
import { DisciplinarySidebar } from "@/components/disciplinary/DisciplinarySidebar";

function titleForPath(pathname: string): string {
  if (pathname === "/disciplinario/empleados") return "Disciplinario · Resumen por empleado";
  if (pathname === "/disciplinario/convocatoria") return "Disciplinario · Solicitud de convocatoria";
  if (pathname === "/disciplinario/proceso") return "Disciplinario · Guía del flujo";
  if (pathname === "/disciplinario/ajustes/bases") return "Disciplinario · Ajustes · Bases de datos";
  if (pathname === "/disciplinario/ajustes/documento") return "Disciplinario · Ajustes · Documento";
  if (pathname === "/disciplinario/ajustes/configuracion") return "Disciplinario · Ajustes · Configuración";
  return "Disciplinario";
}

export function DisciplinarioShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={titleForPath(pathname)} />
      <div className="flex flex-1 min-h-0 items-stretch">
        <DisciplinarySidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((c) => !c)}
        />

        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex-1 min-w-0 overflow-auto">
          <div className="md:hidden flex items-center gap-2 px-3 py-2 border-b bg-white sticky top-0 z-10">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)} className="gap-1.5 h-8">
              <Menu className="h-4 w-4" />
              <span className="text-xs font-medium">Menú</span>
            </Button>
            <span className="text-xs text-slate-400 truncate">{titleForPath(pathname)}</span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
