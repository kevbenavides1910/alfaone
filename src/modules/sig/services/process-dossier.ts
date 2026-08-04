import { prisma } from "@/modules/core/db/prisma";

/**
 * Expediente digital de un proceso SIG: agrega documentos, requisitos,
 * evidencias, controles, riesgos, legales, indicadores, incidentes,
 * auditorías y hallazgos abiertos.
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
    legalPrimary,
    legalLinks,
    indicatorsPrimary,
    indicatorLinks,
    incidentsPrimary,
    incidentLinks,
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
    prisma.sigLegalRequirement.findMany({
      where: {
        processId,
        complianceStatus: { not: "NOT_APPLICABLE" },
      },
      orderBy: [{ complianceStatus: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        legalSource: true,
        complianceStatus: true,
        nextReviewDate: true,
        _count: { select: { evidenceLinks: true } },
      },
    }),
    prisma.sigLegalProcess.findMany({
      where: { processId },
      include: {
        legal: {
          select: {
            id: true,
            code: true,
            title: true,
            legalSource: true,
            complianceStatus: true,
            nextReviewDate: true,
            _count: { select: { evidenceLinks: true } },
          },
        },
      },
    }),
    prisma.sigIndicator.findMany({
      where: { processId, status: { not: "INACTIVE" } },
      orderBy: [{ code: "asc" }],
      select: {
        id: true,
        code: true,
        title: true,
        unit: true,
        direction: true,
        frequency: true,
        targetValue: true,
        status: true,
        measurements: {
          orderBy: { periodStart: "desc" },
          take: 1,
          select: { value: true, periodStart: true },
        },
      },
    }),
    prisma.sigIndicatorProcess.findMany({
      where: { processId },
      include: {
        indicator: {
          select: {
            id: true,
            code: true,
            title: true,
            unit: true,
            direction: true,
            frequency: true,
            targetValue: true,
            status: true,
            measurements: {
              orderBy: { periodStart: "desc" },
              take: 1,
              select: { value: true, periodStart: true },
            },
          },
        },
      },
    }),
    prisma.sigIncident.findMany({
      where: {
        processId,
        status: { notIn: ["CLOSED", "DISMISSED"] },
      },
      orderBy: [{ occurredAt: "desc" }],
      take: 40,
      select: {
        id: true,
        code: true,
        title: true,
        type: true,
        severity: true,
        status: true,
        humanRightsImpact: true,
        occurredAt: true,
      },
    }),
    prisma.sigIncidentProcess.findMany({
      where: { processId },
      include: {
        incident: {
          select: {
            id: true,
            code: true,
            title: true,
            type: true,
            severity: true,
            status: true,
            humanRightsImpact: true,
            occurredAt: true,
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

  const legalMap = new Map<string, (typeof legalPrimary)[number]>();
  for (const l of legalPrimary) legalMap.set(l.id, l);
  for (const link of legalLinks) {
    if (link.legal.complianceStatus === "NOT_APPLICABLE") continue;
    if (!legalMap.has(link.legal.id)) legalMap.set(link.legal.id, link.legal);
  }
  const legalRequirements = Array.from(legalMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  const indicatorsMap = new Map<string, (typeof indicatorsPrimary)[number]>();
  for (const i of indicatorsPrimary) indicatorsMap.set(i.id, i);
  for (const link of indicatorLinks) {
    if (link.indicator.status === "INACTIVE") continue;
    if (!indicatorsMap.has(link.indicator.id)) indicatorsMap.set(link.indicator.id, link.indicator);
  }
  const indicators = Array.from(indicatorsMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  const incidentsMap = new Map<string, (typeof incidentsPrimary)[number]>();
  for (const i of incidentsPrimary) incidentsMap.set(i.id, i);
  for (const link of incidentLinks) {
    if (link.incident.status === "CLOSED" || link.incident.status === "DISMISSED") continue;
    if (!incidentsMap.has(link.incident.id)) incidentsMap.set(link.incident.id, link.incident);
  }
  const incidents = Array.from(incidentsMap.values()).sort(
    (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime()
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
      legalRequirements: legalRequirements.length,
      indicators: indicators.length,
      incidents: incidents.length,
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
    legalRequirements,
    indicators,
    incidents,
    audits,
    openFindings: openFindingsViaDocs,
    overdueActions: overduePlans,
  };
}
