/** Etiquetas de acciones de bitácora SIG (por documento). */
export const SIG_AUDIT_ACTION_LABELS: Record<string, string> = {
  CREATED: "Creado",
  UPDATED: "Metadatos actualizados",
  SUBMITTED_FOR_APPROVAL: "Enviado a aprobación",
  APPROVED: "Aprobado",
  REJECTED: "Rechazado",
  REVISION_DATE_UPDATED: "Fecha de revisión actualizada",
  NEW_VERSION: "Nueva versión",
  SAME_VERSION_UPDATED: "Vigencia actualizada (misma versión)",
  OBSOLETED: "Marcado obsoleto",
  CHANGE_REQUESTED: "Solicitud de cambio",
  CONTENT_UPDATED: "Contenido del procedimiento actualizado",
  READ_ACKNOWLEDGED: "Lectura / capacitación acusada",
};

export function sigAuditActionLabel(action: string): string {
  return SIG_AUDIT_ACTION_LABELS[action] ?? action;
}
