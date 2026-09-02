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
      <p className="py-12 text-center text-sm text-muted-foreground">
        No tiene módulos asignados. Contacte al administrador.
      </p>
    );
  }

  return (
    <section aria-label="Módulos">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Módulos</h2>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
          {tiles.length} disponibles
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4 xl:grid-cols-5">
        {tiles.map((tile) => (
          <Link
            key={tile.id}
            href={tile.href}
            className={cn(
              "home-tile group flex flex-col items-center px-3 py-5 md:px-4 md:py-6",
              "transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-primary)] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-background",
              tile.tile
            )}
          >
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl md:h-14 md:w-14",
                "bg-[#fde2d9] dark:bg-[color:var(--app-primary)]/15"
              )}
            >
              <tile.icon className={cn("h-6 w-6 md:h-7 md:w-7", ICON_COLOR)} strokeWidth={1.5} />
            </div>
            <h3 className="mt-3 text-center text-sm font-bold leading-snug text-foreground">
              {tile.label}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-center text-[11px] font-normal leading-snug text-muted-foreground">
              {tile.description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
