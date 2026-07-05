"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils/cn";
import { HOME_MODULE_TILES } from "@/lib/modules/home-menu";
import { canAccessHomeTile, canAccessModuleFromSession, hasPermission } from "@/lib/permissions/check";

export function HomeModuleGrid() {
  const { data: session } = useSession();

  const tiles = HOME_MODULE_TILES.filter((tile) => {
    if (tile.id === "facturacion") {
      return (
        hasPermission(session, "facturacion.cobro", "view") ||
        hasPermission(session, "facturacion.cxc", "view")
      );
    }
    if (tile.requiredPermission) {
      return hasPermission(session, tile.requiredPermission, "view");
    }
    if (tile.moduleId) {
      return canAccessModuleFromSession(session, tile.moduleId);
    }
    return canAccessHomeTile(session, tile.permissionTileId);
  });

  if (tiles.length === 0) {
    return (
      <p className="text-sm text-slate-500 text-center py-12">
        No tiene módulos asignados. Contacte al administrador.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
      {tiles.map((tile) => (
        <Link
          key={tile.id}
          href={tile.href}
          className={cn(
            "group flex flex-col items-center rounded-2xl p-5 md:p-6",
            "transition-all duration-200",
            "hover:scale-[1.03] hover:shadow-xl hover:shadow-black/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]",
            tile.tile
          )}
        >
          <div
            className={cn(
              "flex h-14 w-14 md:h-16 md:w-16 items-center justify-center rounded-2xl",
              "transition-transform duration-200 group-hover:scale-105",
              tile.accent
            )}
          >
            <tile.icon className="h-7 w-7 md:h-8 md:w-8 text-white" strokeWidth={1.75} />
          </div>
          <h3 className="mt-3.5 text-center text-sm font-semibold text-white/90 leading-snug">
            {tile.label}
          </h3>
          <p className="mt-1 text-center text-[11px] text-white/35 leading-snug line-clamp-2">
            {tile.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
