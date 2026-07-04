"use client";

import { createContext, useContext } from "react";

type SidebarContextType = {
  /** Menú móvil (overlay) */
  mobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
  /** Sidebar estrecho solo iconos (escritorio) */
  collapsed: boolean;
  toggleCollapsed: () => void;
};

export const SidebarContext = createContext<SidebarContextType>({
  mobileOpen: false,
  toggleMobile: () => {},
  closeMobile: () => {},
  collapsed: false,
  toggleCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

/** @deprecated Usar useSidebar().toggleMobile */
export function useSidebarToggle() {
  const { toggleMobile } = useSidebar();
  return toggleMobile;
}
