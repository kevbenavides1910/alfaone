"use client";

import { usePathname } from "next/navigation";
import { Topbar } from "@/components/layout/Topbar";
import { DisciplinaryTopNav } from "@/components/disciplinary/DisciplinaryTopNav";

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

  return (
    <div className="flex flex-col min-h-screen">
      <Topbar title={titleForPath(pathname)} />
      <DisciplinaryTopNav />
      <div className="flex-1 min-w-0 overflow-auto">
        {children}
      </div>
    </div>
  );
}
