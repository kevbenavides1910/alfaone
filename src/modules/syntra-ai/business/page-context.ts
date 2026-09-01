/** Etiquetas de pantalla para contexto del asistente (cliente + servidor). */
const PATH_LABELS: Array<{ prefix: string; label: string }> = [
  { prefix: "/contracts", label: "Contratos" },
  { prefix: "/expenses", label: "Gastos" },
  { prefix: "/facturacion-electronica", label: "Facturación electrónica" },
  { prefix: "/facturacion", label: "Facturación y cobro" },
  { prefix: "/cuentas-por-pagar", label: "Cuentas por pagar" },
  { prefix: "/pagos", label: "Pagos" },
  { prefix: "/empleados-naf", label: "Empleados NAF / Nómina" },
  { prefix: "/empleados", label: "Empleados" },
  { prefix: "/disciplinario", label: "Disciplinario" },
  { prefix: "/inventory", label: "Inventario" },
  { prefix: "/sig", label: "SIG" },
  { prefix: "/tickets-ti", label: "Tickets TI" },
  { prefix: "/recorridos", label: "Recorridos" },
  { prefix: "/monitoreo", label: "Monitoreo" },
  { prefix: "/naf-operaciones", label: "NAF Operaciones" },
  { prefix: "/finger-system", label: "Biométrico" },
  { prefix: "/ventas", label: "Ventas" },
  { prefix: "/admin", label: "Mantenimiento / Admin" },
  { prefix: "/dashboard", label: "Dashboard" },
  { prefix: "/home", label: "Inicio" },
];

export type SyntraAiPageContext = {
  path: string;
  pageTitle?: string | null;
  moduleLabel?: string | null;
};

export function resolvePageModuleLabel(pathname: string): string | null {
  const path = (pathname || "/").split("?")[0];
  for (const { prefix, label } of PATH_LABELS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return label;
  }
  return null;
}

export function formatPageContextLabel(ctx: SyntraAiPageContext | null | undefined): string {
  if (!ctx?.path) return "";
  const parts = [resolvePageModuleLabel(ctx.path) || null, ctx.pageTitle?.trim() || null, ctx.path].filter(
    Boolean,
  ) as string[];
  return [...new Set(parts)].join(" · ");
}

export function buildPageContextPrompt(ctx: SyntraAiPageContext | null | undefined): string {
  const label = formatPageContextLabel(ctx);
  if (!label) return "";
  return `El usuario está en la pantalla: ${label}. Usa este contexto para orientar menús y pasos concretos de Alfa One.`;
}
