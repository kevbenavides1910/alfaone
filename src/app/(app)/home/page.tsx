"use client";

import { useSession } from "@/lib/auth/client-session";
import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { HomeModuleGrid } from "@/components/home/HomeModuleGrid";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { APP_TAGLINE } from "@/modules/plataforma/branding-constants";

export default function HomePage() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "Usuario";

  return (
    <>
      <Topbar title="Inicio" />
      <div className="home-menu-canvas">
        <header className="relative px-6 pt-6 pb-5 md:px-10 md:pt-8 md:pb-6">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                    Hola, <span className="text-[color:var(--app-primary)]">{name}</span>
                  </h1>
                  <ThemeToggle />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{APP_TAGLINE}</p>
              </div>
            </div>
          </div>
        </header>

        <div className="relative px-6 pb-10 md:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <HomeModuleGrid />

            <div className="mt-4">
              <Link
                href="/dashboard"
                className="group flex items-center justify-between gap-4 rounded-2xl bg-white px-4 py-4 shadow-[0_2px_10px_rgba(0,0,0,0.06)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:bg-zinc-900 dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)] md:px-5 md:py-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#fde2d9] dark:bg-red-950/50">
                    <BarChart3 className="h-6 w-6 text-[color:var(--app-primary)]" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-black dark:text-white">Dashboard ejecutivo</p>
                    <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
                      Semáforo de rentabilidad y métricas consolidadas
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
