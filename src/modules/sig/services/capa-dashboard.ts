import { prisma } from "@/modules/core/db/prisma";

export type CapaDashboardFilters = {
  year?: number;
  processId?: string;
};

/** Tablero CAPA: hallazgos, acciones vencidas y eficacia. */
export async function getCapaEfficacyDashboard(filters: CapaDashboardFilters = {}) {
  const year = filters.year ?? new Date().getFullYear();
  const processId = filters.processId;

  const auditWhere = {
    year,
    ...(processId
      ? {
          OR: [
            { procedure: { processId } },
            { programItems: { some: { processId } } },
          ],
        }
      : {}),
  };

  const findingWhere = {
    audit: auditWhere,
  };

  const [
    findingsTotal,
    findingsOpen,
    findingsClosed,
    findingsBySeverity,
    actionsTotal,
    actionsOpen,
    actionsOverdue,
    actionsCompleted,
    efficacyPending,
    efficacyVerified,
    efficacyNotEffective,
    recentOverdue,
    openFindings,
  ] = await Promise.all([
    prisma.finding.count({ where: findingWhere }),
    prisma.finding.count({
      where: { ...findingWhere, status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.finding.count({
      where: { ...findingWhere, status: "CLOSED" },
    }),
    prisma.finding.groupBy({
      by: ["severity"],
      where: { ...findingWhere, status: { in: ["OPEN", "IN_PROGRESS"] } },
      _count: { _all: true },
    }),
    prisma.actionPlan.count({ where: { finding: findingWhere } }),
    prisma.actionPlan.count({
      where: {
        finding: findingWhere,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
    prisma.actionPlan.count({
      where: {
        finding: findingWhere,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
      },
    }),
    prisma.actionPlan.count({
      where: {
        finding: findingWhere,
        status: "COMPLETED",
      },
    }),
    prisma.actionPlan.count({
      where: {
        finding: findingWhere,
        status: "COMPLETED",
        efficacyStatus: "PENDING",
      },
    }),
    prisma.actionPlan.count({
      where: {
        finding: findingWhere,
        efficacyStatus: "VERIFIED",
      },
    }),
    prisma.actionPlan.count({
      where: {
        finding: findingWhere,
        efficacyStatus: "NOT_EFFECTIVE",
      },
    }),
    prisma.actionPlan.findMany({
      where: {
        finding: findingWhere,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
      },
      orderBy: { dueDate: "asc" },
      take: 40,
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        finding: {
          select: {
            id: true,
            title: true,
            severity: true,
            auditId: true,
            audit: {
              select: {
                year: true,
                quarter: true,
                procedure: { select: { code: true, title: true, processId: true } },
              },
            },
          },
        },
        responsibleUser: { select: { id: true, name: true } },
      },
    }),
    prisma.finding.findMany({
      where: { ...findingWhere, status: { in: ["OPEN", "IN_PROGRESS"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        title: true,
        findingType: true,
        severity: true,
        status: true,
        auditId: true,
        createdAt: true,
        audit: {
          select: {
            year: true,
            quarter: true,
            procedure: { select: { code: true, title: true } },
          },
        },
        _count: { select: { actionPlans: true } },
      },
    }),
  ]);

  const closurePct =
    findingsTotal > 0 ? Math.round((findingsClosed / findingsTotal) * 100) : 0;
  const actionCompletionPct =
    actionsTotal > 0 ? Math.round((actionsCompleted / actionsTotal) * 100) : 0;
  const efficacyDone = efficacyVerified + efficacyNotEffective;
  const efficacyPct =
    efficacyDone > 0 ? Math.round((efficacyVerified / efficacyDone) * 100) : 0;

  return {
    year,
    processId: processId ?? null,
    findings: {
      total: findingsTotal,
      open: findingsOpen,
      closed: findingsClosed,
      closurePct,
      bySeverity: Object.fromEntries(
        findingsBySeverity.map((r) => [r.severity, r._count._all])
      ),
      openRows: openFindings,
    },
    actions: {
      total: actionsTotal,
      open: actionsOpen,
      overdue: actionsOverdue,
      completed: actionsCompleted,
      completionPct: actionCompletionPct,
      overdueRows: recentOverdue,
    },
    efficacy: {
      pending: efficacyPending,
      verified: efficacyVerified,
      notEffective: efficacyNotEffective,
      verifiedPct: efficacyPct,
    },
  };
}
