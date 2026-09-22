import type { SigDocumentType } from "@prisma/client";
import { prisma } from "@/modules/core/db/prisma";
import { writeSigAuditLog } from "./audit-log";
import { assertSigApproverUser } from "./approvers";

export type ProcedureStageInput = {
  title: string;
  body: string;
  responsible?: string | null;
  /** Client temp id when editing; ignored on create. */
  clientKey?: string;
};

export type ProcedureBodyInput = {
  objective?: string | null;
  scope?: string | null;
  responsibilities?: string | null;
  definitions?: string | null;
  stages: ProcedureStageInput[];
  changeSummary: string;
  assignedApproverId: string;
  versionLabel?: string | null;
  /** Optional change-request ids to mark IMPLEMENTED after publish. */
  changeRequestIds?: string[];
};

export type ProcedureContentView = {
  documentId: string;
  code: string;
  title: string;
  documentType: { id: string; code: string; name: string };
  versionId: string | null;
  versionLabel: string | null;
  versionStatus: string | null;
  hasStructuredContent: boolean;
  showAsProcedure: boolean;
  body: {
    objective: string | null;
    scope: string | null;
    responsibilities: string | null;
    definitions: string | null;
  } | null;
  stages: {
    id: string;
    sortOrder: number;
    title: string;
    body: string;
    responsible: string | null;
  }[];
  extractedText: string | null;
  downloadUrl: string | null;
};

const PROCEDURE_TYPE_RE = /procedimiento|manual|procedure|proc/i;

export function isProcedureLikeType(type: Pick<SigDocumentType, "code" | "name">): boolean {
  return PROCEDURE_TYPE_RE.test(type.code) || PROCEDURE_TYPE_RE.test(type.name);
}

function trimText(value: string | null | undefined, max = 20000): string | null {
  const t = value?.trim();
  if (!t) return null;
  return t.slice(0, max);
}

/** Heurística: partes numeradas / títulos en mayúsculas → etapas; si no, una sola etapa. */
export function parseExtractedTextToProcedure(text: string): {
  body: {
    objective: string | null;
    scope: string | null;
    responsibilities: string | null;
    definitions: string | null;
  };
  stages: ProcedureStageInput[];
} {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  const body = {
    objective: null as string | null,
    scope: null as string | null,
    responsibilities: null as string | null,
    definitions: null as string | null,
  };

  const sectionPatterns: { key: keyof typeof body; re: RegExp }[] = [
    { key: "objective", re: /^(?:objetivo|objectivo|purpose)\s*[:.\-]?\s*(.*)$/i },
    { key: "scope", re: /^(?:alcance|scope)\s*[:.\-]?\s*(.*)$/i },
    {
      key: "responsibilities",
      re: /^(?:responsabilidades?|responsables?)\s*[:.\-]?\s*(.*)$/i,
    },
    { key: "definitions", re: /^(?:definiciones?|términos?|terminos?)\s*[:.\-]?\s*(.*)$/i },
  ];

  const lines = cleaned.split("\n");
  const stageBlocks: { title: string; lines: string[] }[] = [];
  let current: { title: string; lines: string[] } | null = null;
  let preamble: string[] = [];

  const numberedRe = /^\s*(?:etapa\s+)?(\d{1,3})[.)\-:\s]+(.+)$/i;
  const capsTitleRe = /^\s*([A-ZÁÉÍÓÚÑÜ0-9][A-ZÁÉÍÓÚÑÜ0-9\s\-_/]{3,80})\s*$/;

  for (const raw of lines) {
    const line = raw.trimEnd();
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.lines.push("");
      else preamble.push("");
      continue;
    }

    let matchedSection = false;
    for (const { key, re } of sectionPatterns) {
      const m = trimmed.match(re);
      if (m) {
        const rest = (m[1] || "").trim();
        body[key] = rest || null;
        matchedSection = true;
        break;
      }
    }
    if (matchedSection) continue;

    const num = trimmed.match(numberedRe);
    if (num) {
      if (current) stageBlocks.push(current);
      current = { title: num[2].trim().slice(0, 200) || `Etapa ${num[1]}`, lines: [] };
      continue;
    }

    if (capsTitleRe.test(trimmed) && trimmed.length < 90 && !trimmed.includes(".")) {
      if (current) stageBlocks.push(current);
      current = { title: trimmed.slice(0, 200), lines: [] };
      continue;
    }

    if (current) current.lines.push(line);
    else preamble.push(line);
  }
  if (current) stageBlocks.push(current);

  let stages: ProcedureStageInput[] =
    stageBlocks.length > 0
      ? stageBlocks.map((b) => ({
          title: b.title,
          body: b.lines.join("\n").trim() || b.title,
          responsible: null,
        }))
      : [];

  if (stages.length === 0) {
    const leftover = preamble.join("\n").trim() || cleaned;
    stages = [{ title: "Contenido", body: leftover.slice(0, 50000), responsible: null }];
  } else if (preamble.join("\n").trim() && !body.objective) {
    body.objective = preamble.join("\n").trim().slice(0, 8000);
  }

  return { body, stages };
}

export async function getSigProcedureContent(documentId: string): Promise<ProcedureContentView | null> {
  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: {
      documentType: { select: { id: true, code: true, name: true } },
      currentVersion: {
        include: {
          procedureBody: true,
          procedureStages: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!doc) return null;

  const v = doc.currentVersion;
  const hasStructuredContent = Boolean(v?.procedureBody || (v?.procedureStages.length ?? 0) > 0);
  const showAsProcedure = hasStructuredContent || isProcedureLikeType(doc.documentType);

  return {
    documentId: doc.id,
    code: doc.code,
    title: doc.title,
    documentType: doc.documentType,
    versionId: v?.id ?? null,
    versionLabel: v?.versionLabel ?? null,
    versionStatus: v?.status ?? null,
    hasStructuredContent,
    showAsProcedure,
    body: v?.procedureBody
      ? {
          objective: v.procedureBody.objective,
          scope: v.procedureBody.scope,
          responsibilities: v.procedureBody.responsibilities,
          definitions: v.procedureBody.definitions,
        }
      : null,
    stages: (v?.procedureStages ?? []).map((s) => ({
      id: s.id,
      sortOrder: s.sortOrder,
      title: s.title,
      body: s.body,
      responsible: s.responsible,
    })),
    extractedText: v?.extractedText ?? null,
    downloadUrl: v ? `/api/sig/documents/${doc.id}/download?versionId=${v.id}` : null,
  };
}

/** Bootstrap estructura desde extractedText sobre la versión vigente (sin nueva versión). */
export async function bootstrapProcedureFromExtractedText(documentId: string, actorId: string) {
  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: {
      documentType: true,
      currentVersion: {
        include: {
          procedureBody: true,
          procedureStages: true,
        },
      },
    },
  });
  if (!doc) throw new Error("Documento no encontrado");
  if (doc.status === "OBSOLETE") throw new Error("El documento está obsoleto");
  const version = doc.currentVersion;
  if (!version) throw new Error("El documento no tiene versión");
  if (!version.extractedText?.trim()) {
    throw new Error("No hay texto indexado del archivo para convertir");
  }
  if (version.procedureBody || version.procedureStages.length > 0) {
    throw new Error("Ya existe contenido estructurado; edítelo o publique una nueva versión");
  }

  const parsed = parseExtractedTextToProcedure(version.extractedText);

  await prisma.$transaction(async (tx) => {
    await tx.sigProcedureBody.create({
      data: {
        versionId: version.id,
        objective: parsed.body.objective,
        scope: parsed.body.scope,
        responsibilities: parsed.body.responsibilities,
        definitions: parsed.body.definitions,
      },
    });
    await tx.sigProcedureStage.createMany({
      data: parsed.stages.map((s, i) => ({
        versionId: version.id,
        sortOrder: i + 1,
        title: s.title.trim().slice(0, 300) || `Etapa ${i + 1}`,
        body: s.body.trim().slice(0, 50000) || "—",
        responsible: trimText(s.responsible, 200),
      })),
    });
    await writeSigAuditLog(tx, {
      documentId,
      versionId: version.id,
      action: "CONTENT_UPDATED",
      actorId,
      notes: "Contenido estructurado generado desde texto del archivo",
    });
  });

  return getSigProcedureContent(documentId);
}

/** Publica body+etapas como nueva versión (reutiliza archivo de la versión base). */
export async function publishProcedureContentVersion(
  documentId: string,
  actorId: string,
  input: ProcedureBodyInput
) {
  const changeSummary = input.changeSummary?.trim();
  if (!changeSummary) throw new Error("Indique el resumen de cambios");
  if (!input.stages?.length) throw new Error("Agregue al menos una etapa");

  const assignedApprover = await assertSigApproverUser(input.assignedApproverId);

  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      currentVersion: {
        include: {
          procedureBody: true,
          procedureStages: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!doc) throw new Error("Documento no encontrado");
  if (doc.status === "OBSOLETE") throw new Error("El documento está obsoleto");

  const base = doc.currentVersion ?? doc.versions[0];
  if (!base) throw new Error("El documento no tiene versión base (suba un archivo primero)");

  const lastNumber = doc.versions[0]?.versionNumber ?? 0;
  const nextNumber = lastNumber + 1;
  const versionLabel = (input.versionLabel?.trim() || String(nextNumber)).slice(0, 40);
  const today = new Date();

  const version = await prisma.$transaction(async (tx) => {
    const created = await tx.sigDocumentVersion.create({
      data: {
        documentId,
        versionNumber: nextNumber,
        versionLabel,
        fileName: base.fileName,
        mimeType: base.mimeType,
        storagePath: base.storagePath,
        fileSizeBytes: base.fileSizeBytes,
        checksum: base.checksum,
        revisionDate: today,
        effectiveFrom: today,
        effectiveUntil: base.effectiveUntil,
        changeSummary: changeSummary.slice(0, 4000),
        status: "PENDING_APPROVAL",
        uploadedById: actorId,
        assignedApproverId: assignedApprover.id,
        extractedText: base.extractedText,
        textIndexStatus: base.textIndexStatus,
        textIndexedAt: base.textIndexedAt,
      },
    });

    await tx.sigProcedureBody.create({
      data: {
        versionId: created.id,
        objective: trimText(input.objective),
        scope: trimText(input.scope),
        responsibilities: trimText(input.responsibilities),
        definitions: trimText(input.definitions),
      },
    });

    await tx.sigProcedureStage.createMany({
      data: input.stages.map((s, i) => ({
        versionId: created.id,
        sortOrder: i + 1,
        title: s.title.trim().slice(0, 300) || `Etapa ${i + 1}`,
        body: (s.body?.trim() || "—").slice(0, 50000),
        responsible: trimText(s.responsible, 200),
      })),
    });

    await tx.sigDocument.update({
      where: { id: documentId },
      data: { status: "PENDING_APPROVAL", currentVersionId: created.id },
    });

    await writeSigAuditLog(tx, {
      documentId,
      versionId: created.id,
      action: "CONTENT_UPDATED",
      actorId,
      notes: changeSummary,
      metadata: { versionNumber: nextNumber, versionLabel, stages: input.stages.length },
    });

    await writeSigAuditLog(tx, {
      documentId,
      versionId: created.id,
      action: "NEW_VERSION",
      actorId,
      notes: `Contenido procedimiento v${versionLabel}`,
      metadata: { versionNumber: nextNumber, versionLabel, contentOnly: true },
    });

    await writeSigAuditLog(tx, {
      documentId,
      versionId: created.id,
      action: "SUBMITTED_FOR_APPROVAL",
      actorId,
      metadata: {
        assignedApproverId: assignedApprover.id,
        assignedApproverName: assignedApprover.name,
      },
    });

    const ids = (input.changeRequestIds ?? []).filter(Boolean);
    if (ids.length) {
      await tx.sigChangeRequest.updateMany({
        where: { id: { in: ids }, documentId, status: { in: ["OPEN", "ACCEPTED"] } },
        data: {
          status: "IMPLEMENTED",
          reviewerId: actorId,
          reviewedAt: new Date(),
        },
      });
    }

    return created;
  });

  return { version, procedure: await getSigProcedureContent(documentId) };
}

export async function getSigProcedureByCodeOrId(codeOrId: string): Promise<ProcedureContentView | null> {
  const byId = await prisma.sigDocument.findUnique({ where: { id: codeOrId }, select: { id: true } });
  if (byId) return getSigProcedureContent(byId.id);
  const byCode = await prisma.sigDocument.findUnique({
    where: { code: codeOrId.trim().toUpperCase() },
    select: { id: true },
  });
  if (byCode) return getSigProcedureContent(byCode.id);
  return null;
}
