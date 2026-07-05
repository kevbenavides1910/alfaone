"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { BarChart3, ChevronRight } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { HomeModuleGrid } from "@/components/home/HomeModuleGrid";
import { APP_TAGLINE } from "@/modules/plataforma/branding-constants";

export default function HomePage() {
  const { data: session } = useSession();
  const name = session?.user?.name?.split(" ")[0] ?? "Usuario";

  return (
    <>
      <Topbar title="Inicio" />
      <div className="home-menu-canvas">
        <header className="bg-[#161616] text-white px-6 py-8 md:px-8 md:py-10">
          <div className="mx-auto w-full max-w-6xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/80">
              Portal de gestión
            </p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">
              Bienvenido, {name}
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/85 md:text-base">
              Seleccione un módulo para comenzar. {APP_TAGLINE}.
            </p>
          </div>
        </header>

        <div className="relative mx-auto w-full max-w-6xl px-6 py-8 md:px-8 md:py-10 pb-10">
          <HomeModuleGrid />

          <div className="mt-8">
            <Link
              href="/dashboard"
              className="group flex items-center justify-between gap-4 rounded-xl border border-slate-300/70 bg-white/45 p-4 shadow-sm backdrop-blur-sm transition-all hover:border-slate-400/80 hover:bg-white/60 hover:shadow-md md:p-5"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-700 shadow-sm">
                  <BarChart3 className="h-5 w-5 text-white" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">Dashboard ejecutivo</p>
                  <p className="truncate text-xs text-slate-600">
                    Semáforo de rentabilidad y métricas consolidadas
                  </p>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-700" />
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
