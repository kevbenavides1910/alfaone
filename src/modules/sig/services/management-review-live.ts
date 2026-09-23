import type { SigManagementReviewInputKey } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { listSigRevisionReminders } from "./revision-reminders";
import { listSigIndicators } from "./indicators";
import { MANAGEMENT_REVIEW_INPUT_KEYS } from "./management-reviews";

export type LiveInputBlock = {
  key: SigManagementReviewInputKey;
  label: string;
  summary: string;
  counts: Record<string, number>;
  links: Array<{ href: string; label: string }>;
};

/** Datos vivos por entrada ISO de revisión por la dirección. */
export async function getManagementReviewLiveInputs(reviewId: string): Promise<{
  reviewId: string;
  periodStart: string | null;
  periodEnd: string | null;
  blocks: LiveInputBlock[];
}> {
  const review = await prisma.sigManagementReview.findUnique({
    where: { id: reviewId },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      previousReviewId: true,
      processLinks: { select: { processId: true } },
    },
  });
  if (!review) throw new Error("Revisión no encontrada");

  const processIds = review.processLinks.map((p) => p.processId);
  const periodStart = review.periodStart;
  const periodEnd = review.periodEnd ?? new Date();

  const [
    openFindings,
    overdueActions,
    highRisks,
    indicators,
    reminders,
    auditsInPeriod,
    priorActions,
  ] = await Promise.all([
    prisma.finding.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        findingType: "NONCONFORMITY",
        ...(processIds.length
          ? { audit: { procedure: { processId: { in: processIds } } } }
          : {}),
      },
    }),
    prisma.actionPlan.count({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
        ...(processIds.length
          ? { finding: { audit: { procedure: { processId: { in: processIds } } } } }
          : {}),
      },
    }),
    prisma.sigRisk.count({
      where: {
        status: { not: "CLOSED" },
        OR: [{ residualScore: { gte: 12 } }, { inherentScore: { gte: 15 } }],
        ...(processIds.length
          ? {
              OR: [
                { processId: { in: processIds } },
                { processLinks: { some: { processId: { in: processIds } } } },
              ],
            }
          : {}),
      },
    }),
    listSigIndicators({
      processId: processIds[0],
    }),
    listSigRevisionReminders(30),
    prisma.audit.findMany({
      where: {
        scheduledDate: {
          gte: periodStart ?? new Date(periodEnd.getFullYear(), 0, 1),
          lte: periodEnd,
        },
        ...(processIds.length
          ? { procedure: { processId: { in: processIds } } }
          : {}),
      },
      take: 20,
      orderBy: { scheduledDate: "desc" },
      select: {
        id: true,
        year: true,
        quarter: true,
        status: true,
        procedure: { select: { code: true } },
        _count: { select: { findings: true } },
      },
    }),
    review.previousReviewId
      ? prisma.sigManagementReviewAction.count({
          where: {
            reviewId: review.previousReviewId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
          },
        })
      : Promise.resolve(0),
  ]);

  const typedIndicators = indicators as Array<{
    trafficLight?: string;
    measurementOverdue?: boolean;
    code: string;
    id: string;
  }>;
  const redYellow = typedIndicators.filter(
    (i) => i.trafficLight === "RED" || i.trafficLight === "YELLOW"
  );
  const overdueMeas = typedIndicators.filter((i) => i.measurementOverdue);
  const overdueDocs = reminders.filter((r) => r.isOverdue);

  const byKey: Partial<Record<SigManagementReviewInputKey, LiveInputBlock>> = {
    PRIOR_ACTIONS: {
      key: "PRIOR_ACTIONS",
      label: MANAGEMENT_REVIEW_INPUT_KEYS.find((k) => k.key === "PRIOR_ACTIONS")!.label,
      summary: `${priorActions} acción(es) abiertas de la revisión anterior`,
      counts: { open: priorActions },
      links: review.previousReviewId
        ? [{ href: `/sig/revision-direccion/${review.previousReviewId}`, label: "Revisión previa" }]
        : [],
    },
    NONCONFORMITIES_CAPA: {
      key: "NONCONFORMITIES_CAPA",
      label: MANAGEMENT_REVIEW_INPUT_KEYS.find((k) => k.key === "NONCONFORMITIES_CAPA")!.label,
      summary: `${openFindings} NC abiertas · ${overdueActions} acciones CAPA vencidas`,
      counts: { openFindings, overdueActions },
      links: [
        { href: "/sig/auditorias/capa", label: "Tablero CAPA" },
        { href: "/sig/bandeja", label: "Bandeja" },
      ],
    },
    RISKS_OPPORTUNITIES_EFFICACY: {
      key: "RISKS_OPPORTUNITIES_EFFICACY",
      label: MANAGEMENT_REVIEW_INPUT_KEYS.find((k) => k.key === "RISKS_OPPORTUNITIES_EFFICACY")!.label,
      summary: `${highRisks} riesgo(s) con score alto`,
      counts: { highRisks },
      links: [{ href: "/sig/riesgos", label: "Riesgos" }],
    },
    PROCESS_PERFORMANCE: {
      key: "PROCESS_PERFORMANCE",
      label: MANAGEMENT_REVIEW_INPUT_KEYS.find((k) => k.key === "PROCESS_PERFORMANCE")!.label,
      summary: `${redYellow.length} indicador(es) en rojo/amarillo`,
      counts: { offTarget: redYellow.length },
      links: [{ href: "/sig/indicadores", label: "Indicadores" }],
    },
    QUALITY_OBJECTIVES: {
      key: "QUALITY_OBJECTIVES",
      label: MANAGEMENT_REVIEW_INPUT_KEYS.find((k) => k.key === "QUALITY_OBJECTIVES")!.label,
      summary: `${redYellow.length} fuera de meta · ${overdueMeas.length} medición(es) atrasada(s)`,
      counts: { offTarget: redYellow.length, overdueMeasurements: overdueMeas.length },
      links: [{ href: "/sig/indicadores", label: "Indicadores" }],
    },
    MONITORING_MEASUREMENT: {
      key: "MONITORING_MEASUREMENT",
      label: MANAGEMENT_REVIEW_INPUT_KEYS.find((k) => k.key === "MONITORING_MEASUREMENT")!.label,
      summary: `${overdueMeas.length} medición(es) atrasada(s) · ${overdueDocs.length} doc(s) con revisión vencida`,
      counts: {
        overdueMeasurements: overdueMeas.length,
        overdueDocuments: overdueDocs.length,
      },
      links: [
        { href: "/sig/vigencias", label: "Vigencias" },
        { href: "/sig/indicadores", label: "Indicadores" },
      ],
    },
    AUDIT_RESULTS: {
      key: "AUDIT_RESULTS",
      label: MANAGEMENT_REVIEW_INPUT_KEYS.find((k) => k.key === "AUDIT_RESULTS")!.label,
      summary: `${auditsInPeriod.length} auditoría(s) en el periodo`,
      counts: {
        audits: auditsInPeriod.length,
        findings: auditsInPeriod.reduce((s, a) => s + a._count.findings, 0),
      },
      links: [
        { href: "/sig/auditorias", label: "Auditorías" },
        ...auditsInPeriod.slice(0, 3).map((a) => ({
          href: `/audits/${a.id}`,
          label: `${a.procedure.code} ${a.year}-Q${a.quarter}`,
        })),
      ],
    },
    IMPROVEMENT_OPPORTUNITIES: {
      key: "IMPROVEMENT_OPPORTUNITIES",
      label: MANAGEMENT_REVIEW_INPUT_KEYS.find((k) => k.key === "IMPROVEMENT_OPPORTUNITIES")!.label,
      summary: "Revise hallazgos tipo oportunidad y desviaciones de indicadores",
      counts: { offTargetIndicators: redYellow.length },
      links: [
        { href: "/sig/auditorias/capa", label: "CAPA" },
        { href: "/sig/indicadores", label: "Indicadores" },
      ],
    },
  };

  const blocks = MANAGEMENT_REVIEW_INPUT_KEYS.map((def) => {
    if (byKey[def.key]) return byKey[def.key]!;
    return {
      key: def.key,
      label: def.label,
      summary: "Sin automatización — complete manualmente",
      counts: {},
      links: [] as Array<{ href: string; label: string }>,
    };
  });

  return {
    reviewId,
    periodStart: periodStart?.toISOString() ?? null,
    periodEnd: periodEnd.toISOString(),
    blocks,
  };
}

/** Rellena notas de entradas vacías con el resumen vivo (no marca covered). */
export async function refreshManagementReviewInputsFromLive(
  reviewId: string,
  _actorId: string
) {
  const live = await getManagementReviewLiveInputs(reviewId);
  const inputs = await prisma.sigManagementReviewInput.findMany({
    where: { reviewId },
  });

  await prisma.$transaction(
    inputs.map((row) => {
      const block = live.blocks.find((b) => b.key === row.inputKey);
      if (!block) return prisma.sigManagementReviewInput.update({ where: { id: row.id }, data: {} });
      const note = row.notes?.trim()
        ? row.notes
        : `[Auto] ${block.summary}`;
      return prisma.sigManagementReviewInput.update({
        where: { id: row.id },
        data: { notes: note.slice(0, 8000) },
      });
    })
  );

  return live;
}
