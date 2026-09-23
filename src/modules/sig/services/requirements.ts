import type { Prisma } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";

const requirementListInclude = {
  standard: { select: { id: true, code: true, name: true, year: true } },
  parent: { select: { id: true, code: true, title: true } },
  documentLinks: {
    take: 5,
    include: {
      document: {
        select: {
          id: true,
          code: true,
          currentVersion: { select: { revisionDate: true } },
        },
      },
    },
  },
  evidenceLinks: {
    take: 5,
    include: {
      evidence: { select: { id: true, evidenceDate: true } },
    },
  },
  _count: {
    select: {
      processLinks: true,
      documentLinks: true,
      evidenceLinks: true,
      findingLinks: true,
    },
  },
} satisfies Prisma.SigRequirementInclude;

const requirementDetailInclude = {
  standard: { select: { id: true, code: true, name: true, year: true } },
  parent: { select: { id: true, code: true, title: true } },
  children: {
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    select: { id: true, code: true, title: true, isApplicable: true },
  },
  processLinks: {
    include: { process: { select: { id: true, code: true, name: true } } },
  },
  documentLinks: {
    include: {
      document: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          documentType: { select: { id: true, code: true, name: true } },
          currentVersion: {
            select: {
              id: true,
              versionLabel: true,
              revisionDate: true,
              effectiveFrom: true,
            },
          },
        },
      },
    },
  },
  evidenceLinks: {
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      evidence: {
        select: {
          id: true,
          code: true,
          type: true,
          description: true,
          evidenceDate: true,
          validUntil: true,
          status: true,
          fileName: true,
        },
      },
    },
  },
  findingLinks: {
    orderBy: { createdAt: "desc" },
    take: 30,
    include: {
      finding: {
        select: {
          id: true,
          title: true,
          findingType: true,
          status: true,
          severity: true,
          auditId: true,
        },
      },
    },
  },
} satisfies Prisma.SigRequirementInclude;

export type SigRequirementListItem = Prisma.SigRequirementGetPayload<{
  include: typeof requirementListInclude;
}> & {
  openNcCount: number;
  trafficLight: "RED" | "YELLOW" | "GREEN" | "GRAY";
  /** Máx(lastReviewedAt, docs.revisionDate, evidencias.evidenceDate) */
  lastRevisionAt: string | null;
};

function trimText(value: string | null | undefined, max = 8000) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function maxIsoDate(dates: Array<Date | string | null | undefined>): string | null {
  let best: number | null = null;
  for (const d of dates) {
    if (!d) continue;
    const t = d instanceof Date ? d.getTime() : new Date(d).getTime();
    if (Number.isNaN(t)) continue;
    if (best == null || t > best) best = t;
  }
  return best == null ? null : new Date(best).toISOString();
}

async function touchRequirementReviewed(requirementId: string) {
  await prisma.sigRequirement.update({
    where: { id: requirementId },
    data: { lastReviewedAt: new Date() },
  });
}

export async function listSigRequirements(input: {
  standardId?: string;
  q?: string;
  applicableOnly?: boolean;
} = {}) {
  const where: Prisma.SigRequirementWhereInput = {};
  if (input.standardId) where.standardId = input.standardId;
  if (input.applicableOnly) where.isApplicable = true;
  if (input.q?.trim()) {
    const q = input.q.trim();
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { observations: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.sigRequirement.findMany({
    where,
    // Orden por cláusula (HLS), no por norma: la matriz integrada mezcla normas.
    orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
    include: requirementListInclude,
  });

  const requirementIds = rows.map((r) => r.id);
  const openNcGroups =
    requirementIds.length === 0
      ? []
      : await prisma.sigFindingRequirement.groupBy({
          by: ["requirementId"],
          where: {
            requirementId: { in: requirementIds },
            finding: { status: { not: "CLOSED" }, findingType: "NONCONFORMITY" },
          },
          _count: { _all: true },
        });
  const openNcMap = new Map(openNcGroups.map((g) => [g.requirementId, g._count._all]));

  const mapped = rows.map((row): SigRequirementListItem => {
    const openNcCount = openNcMap.get(row.id) ?? 0;
    let trafficLight: SigRequirementListItem["trafficLight"] = "GRAY";
    if (!row.isApplicable) trafficLight = "GRAY";
    else if (openNcCount > 0) trafficLight = "RED";
    else if (row._count.evidenceLinks > 0 || row._count.documentLinks > 0) trafficLight = "GREEN";
    else trafficLight = "YELLOW";

    const lastRevisionAt = maxIsoDate([
      row.lastReviewedAt,
      ...row.documentLinks.map((l) => l.document.currentVersion?.revisionDate ?? null),
      ...row.evidenceLinks.map((l) => l.evidence.evidenceDate),
    ]);

    return { ...row, openNcCount, trafficLight, lastRevisionAt };
  });

  return mapped.sort((a, b) => {
    const byClause = compareClauseCodes(a.code, b.code);
    if (byClause !== 0) return byClause;
    return a.standard.code.localeCompare(b.standard.code, "es");
  });
}

/** Orden numérico de cláusulas tipo 4, 4.1, 7.1.5.2 (Anexo SL / HLS). */
export function compareClauseCodes(a: string, b: string): number {
  const pa = a.split(/[.\-_/]/).map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  });
  const pb = b.split(/[.\-_/]/).map((p) => {
    const n = Number.parseInt(p, 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  });
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? -1;
    const db = pb[i] ?? -1;
    if (da !== db) return da - db;
  }
  return a.localeCompare(b, "es");
}

export async function getSigRequirementDetail(id: string) {
  const row = await prisma.sigRequirement.findUnique({
    where: { id },
    include: requirementDetailInclude,
  });
  if (!row) return null;
  const lastRevisionAt = maxIsoDate([
    row.lastReviewedAt,
    ...row.documentLinks.map((l) => l.document.currentVersion?.revisionDate ?? null),
    ...row.evidenceLinks.map((l) => l.evidence.evidenceDate),
  ]);
  return { ...row, lastRevisionAt };
}

export async function createSigRequirement(input: {
  standardId: string;
  code: string;
  title: string;
  description?: string | null;
  observations?: string | null;
  parentId?: string | null;
  isApplicable?: boolean;
  sortOrder?: number;
  createdById?: string | null;
}) {
  return prisma.sigRequirement.create({
    data: {
      standardId: input.standardId,
      code: input.code.trim().slice(0, 50),
      title: input.title.trim().slice(0, 300),
      description: trimText(input.description),
      observations: trimText(input.observations),
      parentId: input.parentId || null,
      isApplicable: input.isApplicable ?? true,
      sortOrder: input.sortOrder ?? 0,
      createdById: input.createdById || null,
      lastReviewedAt: new Date(),
    },
    include: requirementDetailInclude,
  });
}

export async function updateSigRequirement(
  id: string,
  input: Partial<{
    code: string;
    title: string;
    description: string | null;
    observations: string | null;
    parentId: string | null;
    isApplicable: boolean;
    sortOrder: number;
    lastReviewedAt: string | null;
    touchReviewed: boolean;
  }>
) {
  const data: Prisma.SigRequirementUpdateInput = {};
  if (input.code !== undefined) data.code = input.code.trim().slice(0, 50);
  if (input.title !== undefined) data.title = input.title.trim().slice(0, 300);
  if (input.description !== undefined) data.description = trimText(input.description);
  if (input.observations !== undefined) data.observations = trimText(input.observations);
  if (input.parentId !== undefined) {
    data.parent = input.parentId ? { connect: { id: input.parentId } } : { disconnect: true };
  }
  if (input.isApplicable !== undefined) data.isApplicable = input.isApplicable;
  if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
  if (input.lastReviewedAt !== undefined) {
    data.lastReviewedAt = input.lastReviewedAt ? new Date(input.lastReviewedAt) : null;
  } else if (
    input.touchReviewed ||
    input.description !== undefined ||
    input.observations !== undefined ||
    input.isApplicable !== undefined
  ) {
    data.lastReviewedAt = new Date();
  }

  return prisma.sigRequirement.update({
    where: { id },
    data,
    include: requirementDetailInclude,
  });
}

/** Borrador de observaciones según estado actual (editable por el usuario). */
export async function suggestRequirementObservations(requirementId: string) {
  const row = await getSigRequirementDetail(requirementId);
  if (!row) throw new Error("Requisito no encontrado");

  const lines: string[] = [];
  lines.push(
    `Requisito ${row.standard.code} ${row.code} — ${row.title}.`
  );
  if (row.description?.trim()) {
    lines.push(`Esperado: ${row.description.trim()}`);
  }
  if (!row.isApplicable) {
    lines.push(
      "Estado: no aplicable. Mantener justificación documentada de la exclusión en el alcance del SGC."
    );
  } else {
    const docs = row.documentLinks.map((l) => l.document.code).join(", ") || "ninguno";
    const evs = row.evidenceLinks.map((l) => l.evidence.code).join(", ") || "ninguna";
    const procs = row.processLinks.map((l) => l.process.code).join(", ") || "ninguno";
    lines.push(`Procesos vinculados: ${procs}.`);
    lines.push(`Documentos de prueba / controlados: ${docs}.`);
    lines.push(`Evidencias objetivas: ${evs}.`);
    if (row.documentLinks.length === 0 && row.evidenceLinks.length === 0) {
      lines.push(
        "Brecha: aún no hay documentos ni evidencias ligadas. Definir responsable, registro esperado y fecha de próxima revisión."
      );
    } else if (row.evidenceLinks.length === 0) {
      lines.push(
        "Hay documentos vinculados; falta evidencia objetiva reciente (registros, actas, mediciones) que demuestre la aplicación."
      );
    } else {
      lines.push(
        "Hay evidencia ligada. Verificar frescura, trazabilidad al proceso y que cubra todo el requisito esperado."
      );
    }
    const openNc = row.findingLinks.filter(
      (f) => f.finding.findingType === "NONCONFORMITY" && f.finding.status !== "CLOSED"
    );
    if (openNc.length) {
      lines.push(
        `Atención: ${openNc.length} NC abierta(s) relacionada(s). Cerrar con acción correctiva y verificar eficacia.`
      );
    }
  }
  lines.push(
    `Borrador generado ${new Date().toISOString().slice(0, 10)}. Edite este texto según la realidad del SGC.`
  );

  return {
    requirementId,
    draft: lines.join("\n\n"),
    current: row.observations,
  };
}

export async function linkRequirementProcess(requirementId: string, processId: string) {
  const row = await prisma.sigRequirementProcess.upsert({
    where: { requirementId_processId: { requirementId, processId } },
    create: { requirementId, processId },
    update: {},
    include: { process: { select: { id: true, code: true, name: true } } },
  });
  await touchRequirementReviewed(requirementId);
  return row;
}

export async function unlinkRequirementProcess(requirementId: string, processId: string) {
  await prisma.sigRequirementProcess.delete({
    where: { requirementId_processId: { requirementId, processId } },
  });
  await touchRequirementReviewed(requirementId);
}

export async function linkRequirementDocument(requirementId: string, documentId: string) {
  const row = await prisma.sigRequirementDocument.upsert({
    where: { requirementId_documentId: { requirementId, documentId } },
    create: { requirementId, documentId },
    update: {},
    include: {
      document: {
        select: {
          id: true,
          code: true,
          title: true,
          status: true,
          currentVersion: { select: { revisionDate: true, versionLabel: true } },
        },
      },
    },
  });
  await touchRequirementReviewed(requirementId);
  return row;
}

export async function unlinkRequirementDocument(requirementId: string, documentId: string) {
  await prisma.sigRequirementDocument.delete({
    where: { requirementId_documentId: { requirementId, documentId } },
  });
  await touchRequirementReviewed(requirementId);
}

export async function linkRequirementEvidence(requirementId: string, evidenceId: string) {
  const row = await prisma.sigEvidenceRequirement.upsert({
    where: { evidenceId_requirementId: { evidenceId, requirementId } },
    create: { evidenceId, requirementId },
    update: {},
    include: {
      evidence: {
        select: {
          id: true,
          code: true,
          type: true,
          description: true,
          evidenceDate: true,
          status: true,
        },
      },
    },
  });
  await touchRequirementReviewed(requirementId);
  return row;
}

export async function unlinkRequirementEvidence(requirementId: string, evidenceId: string) {
  await prisma.sigEvidenceRequirement.delete({
    where: { evidenceId_requirementId: { evidenceId, requirementId } },
  });
  await touchRequirementReviewed(requirementId);
}
