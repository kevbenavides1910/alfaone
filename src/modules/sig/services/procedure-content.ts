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

export type ProcedureSectionView = {
  id: string;
  number: string | null;
  title: string;
  body: string;
  responsible: string | null;
  level: number;
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
  /** Secciones formato corporativo Alfa (1., 2., 6.1…) — lectura unificada. */
  sections: ProcedureSectionView[];
  /** true si sections vienen del texto indexado (aún no persistidas). */
  sectionsFromPreview: boolean;
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

/** Títulos típicos del formato documental Alfa (con o sin número). */
const ALFA_SECTION_TITLES =
  "objetivo\\s+general|objetivo|alcance|referencias?\\s+normativas?|definiciones?|responsabilidades?|documentos?\\s+relacionados?|diagrama\\s+de\\s+flujo|descripci[oó]n\\s+de\\s+(?:actividades|lineamientos)|procesos?\\s+que\\s+interact[uú]an|control\\s+de\\s+cambios|anexos?|finalidad";

export function isProcedureLikeType(type: Pick<SigDocumentType, "code" | "name">): boolean {
  return PROCEDURE_TYPE_RE.test(type.code) || PROCEDURE_TYPE_RE.test(type.name);
}

function trimText(value: string | null | undefined, max = 20000): string | null {
  const t = value?.trim();
  if (!t) return null;
  return t.slice(0, max);
}

function isBoilerplateLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (/^(PROCEDIMIENTO|MANUAL|INSTRUCTIVO|POL[IÍ]TICA)\s*:?\s*$/i.test(t)) return true;
  if (/^C[oó]digo\s*:/i.test(t)) return true;
  if (/^(Emisi[oó]n|Modificaci[oó]n|Versi[oó]n|P[aá]gina)\s*:/i.test(t)) return true;
  if (/COPIA\s+NO\s+CONTROLADA/i.test(t)) return true;
  if (/^Únicamente para efectos de consulta/i.test(t)) return true;
  if (/^Puede consultar la copia controlada/i.test(t)) return true;
  if (/^Grupo Corporativo/i.test(t) && t.length < 80) return true;
  return false;
}

function sectionLevel(number: string | null): number {
  if (!number) return 1;
  return number.split(".").filter(Boolean).length;
}

function mapBodyFromStages(stages: ProcedureStageInput[]) {
  const body = {
    objective: null as string | null,
    scope: null as string | null,
    responsibilities: null as string | null,
    definitions: null as string | null,
  };
  for (const s of stages) {
    const t = s.title.replace(/^\d+(?:\.\d+)*\.?\s*/, "").trim();
    if (/^objetivo/i.test(t) && !body.objective) body.objective = s.body;
    else if (/^alcance/i.test(t) && !body.scope) body.scope = s.body;
    else if (/^responsab/i.test(t) && !body.responsibilities) body.responsibilities = s.body;
    else if (/^definici/i.test(t) && !body.definitions) body.definitions = s.body;
  }
  return body;
}

function splitNumberedTitle(raw: string): { number: string | null; title: string } {
  const m = raw.trim().match(/^(\d+(?:\.\d+)*)\s*[.)]?\s*(.+)$/);
  if (m) return { number: m[1], title: m[2].trim() };
  return { number: null, title: raw.trim() };
}

export function stagesToDisplaySections(
  stages: { id?: string; sortOrder?: number; title: string; body: string; responsible?: string | null }[]
): ProcedureSectionView[] {
  return stages.map((s, i) => {
    const { number, title } = splitNumberedTitle(s.title);
    return {
      id: s.id ?? `preview-${i}`,
      number,
      title,
      body: s.body,
      responsible: s.responsible ?? null,
      level: sectionLevel(number),
    };
  });
}

/** Parsea texto Alfa (PDF indexado) a secciones numeradas del formato documental. */
export function parseExtractedTextToProcedure(text: string): {
  body: {
    objective: string | null;
    scope: string | null;
    responsibilities: string | null;
    definitions: string | null;
  };
  stages: ProcedureStageInput[];
} {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
  const lines = cleaned.split("\n");

  const numberedHeaderRe = new RegExp(
    `^\\s*(\\d+(?:\\.\\d+)*)\\s*[.)]?\\s*(.+?)\\s*$`,
    "i"
  );
  const knownTitleRe = new RegExp(`^(?:${ALFA_SECTION_TITLES})$`, "i");
  const namedHeaderRe = new RegExp(`^\\s*(${ALFA_SECTION_TITLES})\\s*:?\\s*$`, "i");

  function isSectionHeader(number: string, titlePart: string): boolean {
    const t = titlePart.trim();
    if (!t || t.length > 100) return false;
    if (/^[./\\d]/.test(t)) return false; // fechas tipo "16. /08/2018"
    if (/^\d{1,2}\s*[/-]/.test(t)) return false;
    if (/[.!?]$/.test(t) && t.split(/\s+/).length > 6) return false;
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length > 12) return false;
    if (knownTitleRe.test(t)) return true;
    // Subsecciones 6.1 / 6.1.1: título corto que empieza con letra
    if (number.includes(".") && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(t) && words.length <= 10) {
      return true;
    }
    // Secciones top-level: número simple + título con letra inicial
    if (!number.includes(".") && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(t) && words.length <= 10) {
      return true;
    }
    return false;
  }

  const blocks: { number: string | null; title: string; lines: string[] }[] = [];
  let current: { number: string | null; title: string; lines: string[] } | null = null;
  let pastHeader = false;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!pastHeader) {
      if (isBoilerplateLine(trimmed)) continue;
      pastHeader = true;
    }

    if (!trimmed) {
      if (current) current.lines.push("");
      continue;
    }

    const num = trimmed.match(numberedHeaderRe);
    if (num && isSectionHeader(num[1], num[2])) {
      if (current) blocks.push(current);
      current = { number: num[1], title: num[2].trim(), lines: [] };
      continue;
    }

    const named = trimmed.match(namedHeaderRe);
    if (named) {
      if (current) blocks.push(current);
      current = {
        number: null,
        title: named[1].replace(/\s+/g, " ").trim(),
        lines: [],
      };
      continue;
    }

    if (current) current.lines.push(raw.trimEnd());
    else current = { number: null, title: "Introducción", lines: [raw.trimEnd()] };
  }
  if (current) blocks.push(current);

  let stages: ProcedureStageInput[] = blocks
    .filter((b) => !(b.title === "Introducción" && blocks.some((x) => x.number)))
    .map((b) => {
      const displayTitle = b.number ? `${b.number}. ${b.title}` : b.title;
      return {
        title: displayTitle.slice(0, 300),
        body: b.lines.join("\n").trim() || "—",
        responsible: null,
      };
    });

  if (stages.length === 0) {
    stages = [{ title: "Contenido", body: cleaned.slice(0, 50000), responsible: null }];
  }

  return { body: mapBodyFromStages(stages), stages };
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
  const stages = (v?.procedureStages ?? []).map((s) => ({
    id: s.id,
    sortOrder: s.sortOrder,
    title: s.title,
    body: s.body,
    responsible: s.responsible,
  }));
  const hasStructuredContent = Boolean(v?.procedureBody || stages.length > 0);
  const showAsProcedure = hasStructuredContent || isProcedureLikeType(doc.documentType);

  let sections: ProcedureSectionView[] = [];
  let sectionsFromPreview = false;

  if (stages.length > 0) {
    sections = stagesToDisplaySections(stages);
  } else if (v?.extractedText?.trim()) {
    const parsed = parseExtractedTextToProcedure(v.extractedText);
    sections = stagesToDisplaySections(parsed.stages);
    sectionsFromPreview = true;
  } else if (v?.procedureBody) {
    const synth: ProcedureStageInput[] = [];
    if (v.procedureBody.objective) synth.push({ title: "1. Objetivo General", body: v.procedureBody.objective });
    if (v.procedureBody.scope) synth.push({ title: "2. Alcance", body: v.procedureBody.scope });
    if (v.procedureBody.definitions) synth.push({ title: "3. Definiciones", body: v.procedureBody.definitions });
    if (v.procedureBody.responsibilities) {
      synth.push({ title: "4. Responsabilidades", body: v.procedureBody.responsibilities });
    }
    sections = stagesToDisplaySections(synth);
  }

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
    sections,
    sectionsFromPreview,
    body: v?.procedureBody
      ? {
          objective: v.procedureBody.objective,
          scope: v.procedureBody.scope,
          responsibilities: v.procedureBody.responsibilities,
          definitions: v.procedureBody.definitions,
        }
      : null,
    stages,
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
        title: s.title.trim().slice(0, 300) || `Sección ${i + 1}`,
        body: s.body.trim().slice(0, 50000) || "—",
        responsible: trimText(s.responsible, 200),
      })),
    });
    await writeSigAuditLog(tx, {
      documentId,
      versionId: version.id,
      action: "CONTENT_UPDATED",
      actorId,
      notes: "Contenido estructurado generado desde texto del archivo (formato Alfa)",
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
  if (!input.stages?.length) throw new Error("Agregue al menos una sección");

  const assignedApprover = await assertSigApproverUser(input.assignedApproverId);
  const mappedBody = mapBodyFromStages(input.stages);

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
        objective: trimText(input.objective) ?? mappedBody.objective,
        scope: trimText(input.scope) ?? mappedBody.scope,
        responsibilities: trimText(input.responsibilities) ?? mappedBody.responsibilities,
        definitions: trimText(input.definitions) ?? mappedBody.definitions,
      },
    });

    await tx.sigProcedureStage.createMany({
      data: input.stages.map((s, i) => ({
        versionId: created.id,
        sortOrder: i + 1,
        title: s.title.trim().slice(0, 300) || `Sección ${i + 1}`,
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
