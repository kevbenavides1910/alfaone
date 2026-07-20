/** Etiquetas legibles para tipos de gasto (sin dependencias de servidor). */
export function expenseTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    UNIFORMS: "Uniformes",
    AUDIT: "Auditoría",
    DEFERRED_LEGACY: "Diferidos (dist.)",
    ADMIN: "Administrativo",
    TRANSPORT: "Transporte",
    FUEL: "Combustible",
    PHONES: "Teléfonos",
    PLANILLA: "Planilla",
    APERTURA: "Apertura",
    OTHER: "Otros",
  };
  return labels[type] ?? type.replace(/_/g, " ");
}
