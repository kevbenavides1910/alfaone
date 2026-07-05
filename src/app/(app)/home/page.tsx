"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { HomeModuleGrid } from "@/components/home/HomeModuleGrid";
import { APP_NAME, APP_TAGLINE } from "@/modules/plataforma/branding-constants";

export default function HomePage() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "Usuario";

  return (
    <>
      <Topbar title="Inicio" />
      <div className="home-menu-canvas">
        {/* Saludo */}
        <header className="relative px-6 pt-10 pb-6 md:px-10 md:pt-12 md:pb-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex items-stretch gap-4">
              <div className="w-0.5 self-stretch bg-red-600 rounded-full shrink-0" />
              <div>
                <p className="text-xs font-medium uppercase tracking-widest text-white/30 mb-1">
                  {APP_NAME}
                </p>
                <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
                  Hola, <span className="text-red-500">{name}</span>
                </h1>
                <p className="mt-1 text-sm text-white/40">
                  {APP_TAGLINE}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Grid de módulos */}
        <div className="relative px-6 pb-10 md:px-10">
          <div className="mx-auto w-full max-w-6xl">
            <HomeModuleGrid />

            {/* Dashboard ejecutivo */}
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="group flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/4 p-4 backdrop-blur-sm transition-all hover:bg-white/8 hover:border-white/12 md:p-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                    <BarChart3 className="h-5 w-5 text-white/70" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white/90">Dashboard ejecutivo</p>
                    <p className="truncate text-xs text-white/40">
                      Semáforo de rentabilidad y métricas consolidadas
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
