"use client";

import type { CSSProperties, ReactNode, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { clampColumnWidth } from "@/lib/hooks/use-resizable-table-columns";

type Props = ThHTMLAttributes<HTMLTableCellElement> & {
  columnKey: string;
  width?: number;
  onResizeWidth?: (columnKey: string, widthPx: number) => void;
  /** Desactiva el handle (p. ej. columna de acciones estrecha). */
  resizable?: boolean;
  children?: ReactNode;
};

/**
 * <th> con asa de redimensionado. Arrastrar el borde derecho cambia el ancho.
 * Respeta columnas `sticky`: no fuerza `position:relative` (rompe left/right sticky).
 */
function classImpliesSticky(className?: string): boolean {
  if (!className) return false;
  return /(?:^|\s)sticky(?:\s|$)/.test(className);
}

export function ResizableTh({
  columnKey,
  width,
  onResizeWidth,
  resizable = true,
  className,
  style,
  children,
  ...rest
}: Props) {
  const sticky = classImpliesSticky(typeof className === "string" ? className : undefined);
  const mergedStyle: CSSProperties = {
    ...style,
    position: style?.position ?? (sticky ? "sticky" : "relative"),
    ...(width != null
      ? {
          width,
          minWidth: width,
          maxWidth: width,
        }
      : null),
  };

  return (
    <th
      {...rest}
      data-col-key={columnKey}
      className={cn(resizable && onResizeWidth ? "group/resz" : null, className)}
      style={mergedStyle}
    >
      {children}
      {resizable && onResizeWidth ? (
        <span
          role="separator"
          aria-orientation="vertical"
          aria-label={`Redimensionar columna ${columnKey}`}
          tabIndex={0}
          className={cn(
            "absolute right-0 top-0 z-20 h-full w-1.5 cursor-col-resize select-none",
            "opacity-0 transition-opacity group-hover/resz:opacity-100 hover:opacity-100",
            "bg-transparent hover:bg-red-500/40 focus:bg-red-500/40 focus:outline-none",
          )}
          onPointerDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const th = (e.currentTarget as HTMLElement).closest("th");
            if (!th) return;
            const startX = e.clientX;
            const startW = th.getBoundingClientRect().width;
            const target = e.currentTarget;
            target.setPointerCapture(e.pointerId);

            const onMove = (ev: PointerEvent) => {
              const next = clampColumnWidth(startW + (ev.clientX - startX));
              onResizeWidth(columnKey, next);
            };
            const onUp = (ev: PointerEvent) => {
              target.releasePointerCapture(ev.pointerId);
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
          }}
        />
      ) : null}
    </th>
  );
}
