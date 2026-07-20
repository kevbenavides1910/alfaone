"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth/client-session";
import { cn } from "@/lib/utils/cn";
import { HOME_MODULE_TILES } from "@/lib/modules/home-menu";
import { canAccessHomeTile, canAccessModuleFromSession, hasPermission } from "@/lib/permissions/check";

const ICON_COLOR = "text-[color:var(--app-primary)]";

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
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-12">
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
            "group flex flex-col items-center rounded-2xl bg-white px-3 py-5 md:px-4 md:py-6",
            "shadow-[0_2px_10px_rgba(0,0,0,0.06)]",
            "dark:bg-zinc-900 dark:shadow-[0_2px_10px_rgba(0,0,0,0.3)]",
            "transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] dark:hover:shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0f0f0f]",
            tile.tile
          )}
        >
          <div
            className={cn(
              "flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-xl shrink-0",
              "bg-[#fde2d9] dark:bg-red-950/50"
            )}
          >
            <tile.icon className={cn("h-6 w-6 md:h-7 md:w-7", ICON_COLOR)} strokeWidth={1.5} />
          </div>
          <h3 className="mt-3 text-center text-sm font-bold text-black dark:text-white leading-snug">
            {tile.label}
          </h3>
          <p className="mt-1.5 text-center text-[11px] font-normal text-gray-500 dark:text-gray-400 leading-snug line-clamp-3">
            {tile.description}
          </p>
        </Link>
      ))}
    </div>
  );
}
