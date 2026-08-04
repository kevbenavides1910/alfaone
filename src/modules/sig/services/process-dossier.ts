import { prisma } from "@/modules/core/db/prisma";

/**
 * Expediente digital de un proceso SIG: agrega documentos, requisitos,
 * evidencias, controles, auditorías y hallazgos abiertos.
 */
export async function getSigProcessDossier(processId: string) {
  const process = await prisma.sigProcess.findUnique({
    where: { id: processId },
    include: {
      parent: { select: { id: true, code: true, name: true } },
      children: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, code: true, name: true },
      },
    },
  });
  if (!process) return null;

  const [
    documents,
    requirementLinks,
    evidences,
    controlsPrimary,
    controlLinks,
    risksPrimary,
    riskLinks,
    openFindingsViaDocs,
    overduePlans,
  ] = await Promise.all([
    prisma.sigDocument.findMany({
      where: { processId, status: { not: "OBSOLETE" } },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        documentType: { select: { code: true, name: true } },
        currentVersion: { select: { versionLabel: true, revisionDate: true } },
      },
    }),
    prisma.sigRequirementProcess.findMany({
      where: { processId },
      include: {
        requirement: {
          select: {
            id: true,
            code: true,
            title: true,
            isApplicable: true,
            standard: { select: { code: true, name: true } },
            _count: { select: { evidenceLinks: true, findingLinks: true } },
          },
        },
      },
    }),
    prisma.sigEvidence.findMany({
      where: { processId, status: "ACTIVE" },
      orderBy: [{ evidenceDate: "desc" }],
      take: 100,
      select: {
        id: true,
        code: true,
        type: true,
        description: true,
        evidenceDate: true,
        validUntil: true,
        status: true,
      },
    }),
    prisma.sigControl.findMany({
      where: { processId, status: { not: "INACTIVE" } },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        evidenceIntervalDays: true,
        _count: { select: { evidenceLinks: true, requirementLinks: true } },
      },
    }),
    prisma.sigControlProcess.findMany({
      where: { processId },
      include: {
        control: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            evidenceIntervalDays: true,
            _count: { select: { evidenceLinks: true, requirementLinks: true } },
          },
        },
      },
    }),
    prisma.sigRisk.findMany({
      where: { processId, status: { not: "CLOSED" } },
      orderBy: [{ inherentScore: "desc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        kind: true,
        status: true,
        inherentScore: true,
        residualScore: true,
        nextReviewDate: true,
      },
    }),
    prisma.sigRiskProcess.findMany({
      where: { processId },
      include: {
        risk: {
          select: {
            id: true,
            code: true,
            title: true,
            kind: true,
            status: true,
            inherentScore: true,
            residualScore: true,
            nextReviewDate: true,
          },
        },
      },
    }),
    prisma.finding.findMany({
      where: {
        status: { not: "CLOSED" },
        audit: { procedure: { processId } },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 50,
      select: {
        id: true,
        title: true,
        findingType: true,
        severity: true,
        status: true,
        auditId: true,
        createdAt: true,
      },
    }),
    prisma.actionPlan.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: new Date() },
        finding: { audit: { procedure: { processId } } },
      },
      orderBy: [{ dueDate: "asc" }],
      take: 30,
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        findingId: true,
        finding: { select: { auditId: true, title: true } },
      },
    }),
  ]);

  const documentIds = documents.map((d) => d.id);
  const audits = documentIds.length
    ? await prisma.audit.findMany({
        where: { procedureId: { in: documentIds } },
        orderBy: [{ year: "desc" }, { quarter: "desc" }, { scheduledDate: "desc" }],
        take: 40,
        select: {
          id: true,
          year: true,
          quarter: true,
          status: true,
          scheduledDate: true,
          procedure: { select: { id: true, code: true, title: true } },
          _count: { select: { findings: true } },
        },
      })
    : [];

  const controlsMap = new Map<string, (typeof controlsPrimary)[number]>();
  for (const c of controlsPrimary) controlsMap.set(c.id, c);
  for (const link of controlLinks) {
    if (!controlsMap.has(link.control.id)) controlsMap.set(link.control.id, link.control);
  }
  const controls = Array.from(controlsMap.values()).sort((a, b) => a.code.localeCompare(b.code));

  const risksMap = new Map<string, (typeof risksPrimary)[number]>();
  for (const r of risksPrimary) risksMap.set(r.id, r);
  for (const link of riskLinks) {
    if (link.risk.status === "CLOSED") continue;
    if (!risksMap.has(link.risk.id)) risksMap.set(link.risk.id, link.risk);
  }
  const risks = Array.from(risksMap.values()).sort(
    (a, b) => b.inherentScore - a.inherentScore || a.code.localeCompare(b.code)
  );

  const requirements = requirementLinks.map((l) => l.requirement);
  const procedures = documents.filter(
    (d) =>
      d.documentType.code === "PROCEDIMIENTO" ||
      d.documentType.code === "PROCEDURE" ||
      d.documentType.code === "PROC" ||
      d.documentType.name.toLowerCase().includes("procedimiento")
  );
  const forms = documents.filter((d) => !procedures.some((p) => p.id === d.id));

  return {
    process,
    summary: {
      procedures: procedures.length,
      documents: documents.length,
      forms: forms.length,
      requirements: requirements.length,
      evidences: evidences.length,
      controls: controls.length,
      risks: risks.length,
      audits: audits.length,
      openFindings: openFindingsViaDocs.length,
      overdueActions: overduePlans.length,
    },
    procedures,
    documents,
    requirements,
    evidences,
    controls,
    risks,
    audits,
    openFindings: openFindingsViaDocs,
    overdueActions: overduePlans,
  };
}
