/** Semáforo de cumplimiento de requisitos SIG (con frescura). */

export type RequirementTrafficLight = "RED" | "YELLOW" | "GREEN" | "GRAY";

export type RequirementComplianceReason =
  | "N_A"
  | "OPEN_NC"
  | "NO_EVIDENCE"
  | "STALE"
  | "COMPLIANT";

/** Días máximos sin revisión/evidencia antes de marcar STALE (si no hay validUntil). */
export const DEFAULT_REQUIREMENT_FRESHNESS_DAYS = 365;

export type TrafficInput = {
  isApplicable: boolean;
  openNcCount: number;
  /** Fechas de prueba (evidencias / revisiones de docs / lastReviewedAt). */
  proofDates: Array<Date | string | null | undefined>;
  /** Si alguna evidencia tiene validUntil vencido, forzar STALE. */
  hasExpiredProof?: boolean;
  /** Hay al menos un vínculo de documento o evidencia. */
  hasProofLinks: boolean;
  now?: Date;
  freshnessDays?: number;
};

export function computeRequirementTraffic(input: TrafficInput): {
  trafficLight: RequirementTrafficLight;
  complianceReason: RequirementComplianceReason;
  lastProofAt: string | null;
} {
  const now = input.now ?? new Date();
  const freshnessDays = input.freshnessDays ?? DEFAULT_REQUIREMENT_FRESHNESS_DAYS;

  let lastProofMs: number | null = null;
  for (const d of input.proofDates) {
    if (!d) continue;
    const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (lastProofMs == null || t > lastProofMs) lastProofMs = t;
  }
  const lastProofAt = lastProofMs == null ? null : new Date(lastProofMs).toISOString();

  if (!input.isApplicable) {
    return { trafficLight: "GRAY", complianceReason: "N_A", lastProofAt };
  }
  if (input.openNcCount > 0) {
    return { trafficLight: "RED", complianceReason: "OPEN_NC", lastProofAt };
  }
  if (!input.hasProofLinks) {
    return { trafficLight: "YELLOW", complianceReason: "NO_EVIDENCE", lastProofAt };
  }

  if (input.hasExpiredProof) {
    return { trafficLight: "YELLOW", complianceReason: "STALE", lastProofAt };
  }

  if (lastProofMs != null) {
    const ageDays = (now.getTime() - lastProofMs) / (1000 * 60 * 60 * 24);
    if (ageDays > freshnessDays) {
      return { trafficLight: "YELLOW", complianceReason: "STALE", lastProofAt };
    }
  } else {
    // Hay vínculos pero sin fecha usable → tratar como sin prueba fresca
    return { trafficLight: "YELLOW", complianceReason: "STALE", lastProofAt };
  }

  return { trafficLight: "GREEN", complianceReason: "COMPLIANT", lastProofAt };
}

export const COMPLIANCE_LABEL: Record<RequirementComplianceReason, string> = {
  N_A: "No aplicable",
  OPEN_NC: "NC abiertas",
  NO_EVIDENCE: "Sin evidencias",
  STALE: "Evidencia vencida",
  COMPLIANT: "Con evidencias",
};
