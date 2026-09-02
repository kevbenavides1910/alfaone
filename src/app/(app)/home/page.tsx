"use client";

import { useSession } from "@/lib/auth/client-session";
import { Topbar } from "@/components/layout/Topbar";
import { HomeModuleGrid } from "@/components/home/HomeModuleGrid";
import { HomeInsights } from "@/components/home/HomeInsights";
import { APP_NAME, APP_TAGLINE } from "@/modules/plataforma/branding-constants";

export default function HomePage() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "Usuario";
  const role = session?.user?.roleCode ?? session?.user?.role ?? "—";
  const year = new Date().getFullYear();

  return (
    <>
      <Topbar title="Inicio" />
      <div className="home-menu-canvas">
        <header className="relative px-6 pt-7 pb-2 md:px-10 md:pt-9">
          <div className="mx-auto w-full max-w-6xl">
            <div className="min-w-0">
              <h1 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl">
                Hola, <span className="text-[color:var(--app-primary)]">{name}</span>
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">{APP_TAGLINE}</p>
            </div>
          </div>
        </header>

        <div className="relative flex-1 px-6 pb-6 pt-5 md:px-10 md:pt-6">
          <div className="mx-auto w-full max-w-6xl">
            <HomeInsights />
            <HomeModuleGrid />
          </div>
        </div>

        <footer className="home-footer-bar">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              © {year} {APP_NAME}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" aria-hidden />
              Sistema operativo
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Estado: <span className="text-foreground/80">Activo</span>
            </span>
            <span>
              Rol: <span className="text-foreground/80">{role}</span>
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
