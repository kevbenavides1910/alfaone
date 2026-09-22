import { prisma } from "@/modules/core/db/prisma";

/**
 * Trazabilidad de un documento: controles, requisitos, riesgos (vía controles)
 * y auditorías del proceso al que pertenece.
 */
export async function getSigDocumentTraceability(documentId: string) {
  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      code: true,
      title: true,
      processId: true,
      process: { select: { id: true, code: true, name: true } },
    },
  });
  if (!doc) return null;

  const [controlLinks, requirementLinks, audits] = await Promise.all([
    prisma.sigControlDocument.findMany({
      where: { documentId },
      include: {
        control: {
          select: {
            id: true,
            code: true,
            title: true,
            status: true,
            riskLinks: {
              include: {
                risk: {
                  select: {
                    id: true,
                    code: true,
                    title: true,
                    kind: true,
                    status: true,
                    residualScore: true,
                    inherentScore: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.sigRequirementDocument.findMany({
      where: { documentId },
      include: {
        requirement: {
          select: {
            id: true,
            code: true,
            title: true,
            isApplicable: true,
            standard: { select: { code: true, name: true } },
          },
        },
      },
    }),
    doc.processId
      ? prisma.audit.findMany({
          where: {
            OR: [
              { procedureId: documentId },
              {
                programItems: {
                  some: { processId: doc.processId },
                },
              },
            ],
          },
          orderBy: { scheduledDate: "desc" },
          take: 20,
          select: {
            id: true,
            year: true,
            quarter: true,
            status: true,
            scheduledDate: true,
            procedureId: true,
            procedure: { select: { code: true, title: true } },
          },
        })
      : prisma.audit.findMany({
          where: { procedureId: documentId },
          orderBy: { scheduledDate: "desc" },
          take: 20,
          select: {
            id: true,
            year: true,
            quarter: true,
            status: true,
            scheduledDate: true,
            procedureId: true,
            procedure: { select: { code: true, title: true } },
          },
        }),
  ]);

  const controls = controlLinks.map((l) => ({
    id: l.control.id,
    code: l.control.code,
    title: l.control.title,
    status: l.control.status,
    risks: l.control.riskLinks.map((rl) => rl.risk),
  }));

  const requirements = requirementLinks.map((l) => l.requirement);

  // Controles del mismo proceso no ligados explícitamente (sugeridos)
  const processControls = doc.processId
    ? await prisma.sigControl.findMany({
        where: {
          status: { not: "INACTIVE" },
          OR: [
            { processId: doc.processId },
            { processLinks: { some: { processId: doc.processId } } },
          ],
          NOT: { documentLinks: { some: { documentId } } },
        },
        take: 30,
        select: { id: true, code: true, title: true, status: true },
        orderBy: { code: "asc" },
      })
    : [];

  return {
    document: doc,
    controls,
    requirements,
    audits,
    processControlsSuggested: processControls,
  };
}

/** Matriz documento × controles/riesgos de un proceso. */
export async function getSigProcessDocumentMatrix(processId: string) {
  const process = await prisma.sigProcess.findUnique({
    where: { id: processId },
    select: { id: true, code: true, name: true },
  });
  if (!process) return null;

  const documents = await prisma.sigDocument.findMany({
    where: { processId, status: { not: "OBSOLETE" } },
    orderBy: { code: "asc" },
    select: {
      id: true,
      code: true,
      title: true,
      status: true,
      documentType: { select: { code: true, name: true } },
      currentVersion: { select: { versionLabel: true } },
      controlLinks: {
        include: {
          control: {
            select: {
              id: true,
              code: true,
              title: true,
              status: true,
              riskLinks: {
                include: {
                  risk: {
                    select: {
                      id: true,
                      code: true,
                      title: true,
                      kind: true,
                      residualScore: true,
                      inherentScore: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      requirementLinks: {
        include: {
          requirement: {
            select: { id: true, code: true, title: true },
          },
        },
      },
    },
  });

  const rows = documents.map((d) => ({
    id: d.id,
    code: d.code,
    title: d.title,
    status: d.status,
    documentType: d.documentType,
    versionLabel: d.currentVersion?.versionLabel ?? null,
    controls: d.controlLinks.map((l) => ({
      id: l.control.id,
      code: l.control.code,
      title: l.control.title,
      status: l.control.status,
      risks: l.control.riskLinks.map((rl) => rl.risk),
    })),
    requirements: d.requirementLinks.map((l) => l.requirement),
  }));

  return { process, rows };
}
