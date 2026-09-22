import type { Prisma, SigDocumentType } from "@prisma/client";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/modules/core/db/prisma";
import { writeSigAuditLog } from "./audit-log";
import { assertSigApproverUser } from "./approvers";
import { sigDocumentDir, storagePathForSigFile } from "./document-uploads";
import {
  ALFA_FIXED_SECTIONS,
  displaySectionTitle,
  matchSectionKeyFromTitle,
  sectionDef,
  type AlfaSectionKey,
} from "../business/procedure-sections";

export type ProcedureActivityInput = {
  code: string;
  name: string;
  description: string;
  documents?: string | null;
  responsible?: string | null;
};

export type ProcedureStageInput = {
  title: string;
  body: string;
  responsible?: string | null;
  sectionKey?: AlfaSectionKey | null;
  clientKey?: string;
};

export type ProcedureBodyInput = {
  objective?: string | null;
  scope?: string | null;
  responsibilities?: string | null;
  definitions?: string | null;
  stages: ProcedureStageInput[];
  activities: ProcedureActivityInput[];
  changeSummary: string;
  assignedApproverId: string;
  versionLabel?: string | null;
  changeRequestIds?: string[];
  flowchart?: {
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    size: number;
  } | null;
  clearFlowchart?: boolean;
};

export type ProcedureSectionView = {
  id: string;
  sectionKey: AlfaSectionKey | null;
  number: string | null;
  title: string;
  /** Título fijo de catálogo; no editable en UI. */
  titleLocked: boolean;
  kind: "prose" | "flowchart" | "activities";
  body: string;
  responsible: string | null;
  level: number;
};

export type ProcedureActivityView = {
  id: string;
  sortOrder: number;
  code: string;
  name: string;
  description: string;
  documents: string | null;
  responsible: string | null;
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
  sections: ProcedureSectionView[];
  sectionsFromPreview: boolean;
  activities: ProcedureActivityView[];
  flowchartUrl: string | null;
  body: {
    objective: string | null;
    scope: string | null;
    responsibilities: string | null;
    definitions: string | null;
  } | null;
  stages: {
    id: string;
    sortOrder: number;
    sectionKey: string | null;
    title: string;
    body: string;
    responsible: string | null;
  }[];
  extractedText: string | null;
  downloadUrl: string | null;
};

const PROCEDURE_TYPE_RE = /procedimiento|manual|procedure|proc/i;
const FLOWCHART_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_FLOWCHART_BYTES = 15 * 1024 * 1024;

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
  if (/^(Actividad|Descripci[oó]n|Documentos|Responsable)$/i.test(t)) return true;
  return false;
}

function mapBodyFromKeyed(
  byKey: Partial<Record<AlfaSectionKey, string>>
): {
  objective: string | null;
  scope: string | null;
  responsibilities: string | null;
  definitions: string | null;
} {
  return {
    objective: byKey.OBJETIVO_GENERAL ?? null,
    scope: byKey.ALCANCE ?? null,
    responsibilities: byKey.RESPONSABILIDADES ?? null,
    definitions: byKey.DEFINICIONES ?? null,
  };
}

/** Parsea filas de la tabla Actividad | Descripción | Documentos | Responsable. */
export function parseActivitiesFromText(text: string): ProcedureActivityInput[] {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ");
  const start =
    cleaned.search(/descripci[oó]n\s+de\s+actividades/i) >= 0
      ? cleaned.search(/descripci[oó]n\s+de\s+actividades/i)
      : 0;
  const endCandidates = [
    cleaned.search(/\n\s*procesos?\s+que\s+interact/i),
    cleaned.search(/\n\s*control\s+de\s+cambios/i),
    cleaned.search(/\n\s*anexos?\s*$/im),
  ].filter((i) => i > start);
  const end = endCandidates.length ? Math.min(...endCandidates) : cleaned.length;
  const chunk = cleaned.slice(start, end);
  const lines = chunk.split("\n");

  const activityStart = /^(\d+\.\d+(?:\.\d+)*)\s+(.+)$/;
  type Block = { code: string; name: string; lines: string[] };
  const blocks: Block[] = [];
  let cur: Block | null = null;

  for (const raw of lines) {
    const t = raw.trim();
    if (isBoilerplateLine(t) && !activityStart.test(t)) continue;
    const m = t.match(activityStart);
    if (m) {
      if (cur) blocks.push(cur);
      cur = { code: m[1], name: m[2].trim().slice(0, 200), lines: [] };
      continue;
    }
    if (cur && t) cur.lines.push(t);
  }
  if (cur) blocks.push(cur);

  return blocks.map((b) => {
    const ls = b.lines;
    let description = ls.join("\n");
    let documents: string | null = null;
    let responsible: string | null = null;
    if (ls.length >= 2) {
      const last = ls[ls.length - 1];
      const prev = ls[ls.length - 2];
      const looksMeta = (s: string) =>
        s.length <= 140 ||
        /^(NA|N\/A)$/i.test(s) ||
        /\b(F-[A-Z]{1,3}-\d+|Sistema|SICOP|APEX|Centro|correo|Oficio|formulario)\b/i.test(s) ||
        /\b(Encargado|Director|Financiero|Comercial|Coordinador|Supervisor|Gerente)\b/i.test(s);
      if (looksMeta(last)) {
        responsible = last;
        if (looksMeta(prev) || prev.length <= 160) {
          documents = prev;
          description = ls.slice(0, -2).join("\n").trim() || "—";
        } else {
          description = ls.slice(0, -1).join("\n").trim() || "—";
        }
      }
    }
    return {
      code: b.code,
      name: b.name,
      description: description || "—",
      documents,
      responsible,
    };
  });
}

export function parseExtractedTextToProcedure(text: string): {
  body: {
    objective: string | null;
    scope: string | null;
    responsibilities: string | null;
    definitions: string | null;
  };
  stages: ProcedureStageInput[];
  activities: ProcedureActivityInput[];
} {
  const cleaned = text.replace(/\r\n/g, "\n").replace(/\u00a0/g, " ").trim();
  const lines = cleaned.split("\n");
  const numberedHeaderRe = /^\s*(\d+(?:\.\d+)*)\s*[.)]?\s*(.+?)\s*$/i;

  function isTopSectionHeader(number: string, titlePart: string): boolean {
    if (number.includes(".")) return false; // 6.1 = actividad, no sección
    const key = matchSectionKeyFromTitle(titlePart);
    if (key) return true;
    const t = titlePart.trim();
    if (!t || t.length > 80) return false;
    if (/^[./\\d]/.test(t)) return false;
    const words = t.split(/\s+/).filter(Boolean);
    return words.length <= 8 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(t);
  }

  type Block = { number: string | null; title: string; key: AlfaSectionKey | null; lines: string[] };
  const blocks: Block[] = [];
  let current: Block | null = null;
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

    const namedKey = matchSectionKeyFromTitle(trimmed);
    const num = trimmed.match(numberedHeaderRe);

    if (namedKey && !/^\d+\.\d+/.test(trimmed)) {
      // "Objetivo General" or "6. Descripción..." handled below if numbered
      if (!num || !num[1].includes(".")) {
        if (current) blocks.push(current);
        const def = sectionDef(namedKey);
        current = {
          number: num && !num[1].includes(".") ? num[1] : def.number,
          title: def.title,
          key: namedKey,
          lines: [],
        };
        continue;
      }
    }

    if (num && isTopSectionHeader(num[1], num[2])) {
      const key = matchSectionKeyFromTitle(num[2]);
      if (current) blocks.push(current);
      current = {
        number: num[1],
        title: key ? sectionDef(key).title : num[2].trim(),
        key,
        lines: [],
      };
      continue;
    }

    if (current) current.lines.push(raw.trimEnd());
  }
  if (current) blocks.push(current);

  const activities = parseActivitiesFromText(cleaned);
  const byKey: Partial<Record<AlfaSectionKey, string>> = {};
  const stages: ProcedureStageInput[] = [];

  for (const b of blocks) {
    if (!b.key) continue;
    const def = sectionDef(b.key);
    if (def.kind === "activities") {
      stages.push({
        sectionKey: b.key,
        title: displaySectionTitle(b.key),
        body: "",
      });
      continue;
    }
    if (def.kind === "flowchart") {
      stages.push({
        sectionKey: b.key,
        title: displaySectionTitle(b.key),
        body: b.lines.join("\n").trim() || "",
      });
      continue;
    }
    const body = b.lines.join("\n").trim();
    byKey[b.key] = body || null!;
    stages.push({
      sectionKey: b.key,
      title: displaySectionTitle(b.key),
      body: body || "—",
    });
  }

  // Ensure fixed skeleton always present (empty bodies ok)
  const present = new Set(stages.map((s) => s.sectionKey).filter(Boolean));
  for (const def of ALFA_FIXED_SECTIONS) {
    if (present.has(def.key)) continue;
    // Skip optional empty middle sections that rarely appear? Keep all for consistency.
    stages.push({
      sectionKey: def.key,
      title: displaySectionTitle(def.key),
      body: def.kind === "prose" ? "" : "",
    });
  }

  // Order by catalog
  stages.sort((a, b) => {
    const ia = ALFA_FIXED_SECTIONS.findIndex((s) => s.key === a.sectionKey);
    const ib = ALFA_FIXED_SECTIONS.findIndex((s) => s.key === b.sectionKey);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  return { body: mapBodyFromKeyed(byKey), stages, activities };
}

function buildSectionsView(input: {
  stages: { id: string; sectionKey: string | null; title: string; body: string; responsible: string | null }[];
  fromPreview?: boolean;
}): ProcedureSectionView[] {
  const byKey = new Map(
    input.stages.filter((s) => s.sectionKey).map((s) => [s.sectionKey as AlfaSectionKey, s])
  );

  return ALFA_FIXED_SECTIONS.map((def) => {
    const row = byKey.get(def.key);
    return {
      id: row?.id ?? `fixed-${def.key}`,
      sectionKey: def.key,
      number: def.number,
      title: def.title,
      titleLocked: true,
      kind: def.kind,
      body: row?.body ?? "",
      responsible: row?.responsible ?? null,
      level: 1,
    };
  }).filter((s) => {
    if (s.kind === "flowchart" || s.kind === "activities") return true;
    if (s.body.trim()) return true;
    const def = ALFA_FIXED_SECTIONS.find((d) => d.key === s.sectionKey);
    return Boolean(def?.alwaysShow);
  });
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
          procedureActivities: { orderBy: { sortOrder: "asc" } },
        },
      },
    },
  });
  if (!doc) return null;

  const v = doc.currentVersion;
  const stages = (v?.procedureStages ?? []).map((s) => ({
    id: s.id,
    sortOrder: s.sortOrder,
    sectionKey: s.sectionKey,
    title: s.title,
    body: s.body,
    responsible: s.responsible,
  }));
  const activitiesDb = (v?.procedureActivities ?? []).map((a) => ({
    id: a.id,
    sortOrder: a.sortOrder,
    code: a.code,
    name: a.name,
    description: a.description,
    documents: a.documents,
    responsible: a.responsible,
  }));

  const hasStructuredContent = Boolean(
    v?.procedureBody || stages.length > 0 || activitiesDb.length > 0
  );
  const showAsProcedure = hasStructuredContent || isProcedureLikeType(doc.documentType);

  let sections: ProcedureSectionView[] = [];
  let activities = activitiesDb;
  let sectionsFromPreview = false;

  if (stages.length > 0 || activitiesDb.length > 0) {
    sections = buildSectionsView({ stages });
  } else if (v?.extractedText?.trim()) {
    const parsed = parseExtractedTextToProcedure(v.extractedText);
    sectionsFromPreview = true;
    sections = buildSectionsView({
      stages: parsed.stages.map((s, i) => ({
        id: `preview-${s.sectionKey ?? i}`,
        sectionKey: s.sectionKey ?? null,
        title: s.title,
        body: s.body,
        responsible: null,
      })),
      fromPreview: true,
    });
    activities = parsed.activities.map((a, i) => ({
      id: `preview-act-${i}`,
      sortOrder: i + 1,
      ...a,
      documents: a.documents ?? null,
      responsible: a.responsible ?? null,
    }));
  }

  const flowchartUrl =
    v?.procedureBody?.flowchartStoragePath
      ? `/api/sig/documents/${doc.id}/procedure/flowchart`
      : null;

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
    activities,
    flowchartUrl,
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

async function persistStructuredContent(
  tx: Prisma.TransactionClient,
  versionId: string,
  parsed: {
    body: {
      objective: string | null;
      scope: string | null;
      responsibilities: string | null;
      definitions: string | null;
    };
    stages: ProcedureStageInput[];
    activities: ProcedureActivityInput[];
  },
  flowchart?: {
    fileName: string;
    mimeType: string;
    storagePath: string;
    fileSizeBytes: number;
  } | null,
  clearFlowchart?: boolean,
  baseFlowchart?: {
    flowchartFileName: string | null;
    flowchartMimeType: string | null;
    flowchartStoragePath: string | null;
    flowchartFileSizeBytes: number | null;
  } | null
) {
  const flowchartData = clearFlowchart
    ? {
        flowchartFileName: null,
        flowchartMimeType: null,
        flowchartStoragePath: null,
        flowchartFileSizeBytes: null,
      }
    : flowchart
      ? {
          flowchartFileName: flowchart.fileName,
          flowchartMimeType: flowchart.mimeType,
          flowchartStoragePath: flowchart.storagePath,
          flowchartFileSizeBytes: flowchart.fileSizeBytes,
        }
      : baseFlowchart
        ? {
            flowchartFileName: baseFlowchart.flowchartFileName,
            flowchartMimeType: baseFlowchart.flowchartMimeType,
            flowchartStoragePath: baseFlowchart.flowchartStoragePath,
            flowchartFileSizeBytes: baseFlowchart.flowchartFileSizeBytes,
          }
        : {};

  await tx.sigProcedureBody.upsert({
    where: { versionId },
    create: {
      versionId,
      objective: parsed.body.objective,
      scope: parsed.body.scope,
      responsibilities: parsed.body.responsibilities,
      definitions: parsed.body.definitions,
      ...flowchartData,
    },
    update: {
      objective: parsed.body.objective,
      scope: parsed.body.scope,
      responsibilities: parsed.body.responsibilities,
      definitions: parsed.body.definitions,
      ...flowchartData,
    },
  });

  await tx.sigProcedureStage.deleteMany({ where: { versionId } });
  await tx.sigProcedureStage.createMany({
    data: ALFA_FIXED_SECTIONS.map((def, i) => {
      const found = parsed.stages.find((s) => s.sectionKey === def.key);
      return {
        versionId,
        sortOrder: i + 1,
        sectionKey: def.key,
        title: displaySectionTitle(def.key),
        body: (found?.body ?? "").slice(0, 50000) || (def.kind === "prose" ? "" : ""),
        responsible: trimText(found?.responsible, 200),
      };
    }),
  });

  await tx.sigProcedureActivity.deleteMany({ where: { versionId } });
  if (parsed.activities.length) {
    await tx.sigProcedureActivity.createMany({
      data: parsed.activities.map((a, i) => ({
        versionId,
        sortOrder: i + 1,
        code: a.code.trim().slice(0, 40) || `${i + 1}`,
        name: a.name.trim().slice(0, 300) || `Actividad ${i + 1}`,
        description: (a.description?.trim() || "—").slice(0, 50000),
        documents: trimText(a.documents, 4000),
        responsible: trimText(a.responsible, 200),
      })),
    });
  }
}

export async function bootstrapProcedureFromExtractedText(documentId: string, actorId: string) {
  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: {
      currentVersion: {
        include: { procedureBody: true, procedureStages: true, procedureActivities: true },
      },
    },
  });
  if (!doc) throw new Error("Documento no encontrado");
  if (doc.status === "OBSOLETE") throw new Error("El documento está obsoleto");
  const version = doc.currentVersion;
  if (!version) throw new Error("El documento no tiene versión");
  if (!version.extractedText?.trim()) throw new Error("No hay texto indexado del archivo para convertir");
  if (version.procedureStages.length > 0 || version.procedureActivities.length > 0) {
    throw new Error("Ya existe contenido estructurado; edítelo o publique una nueva versión");
  }

  const parsed = parseExtractedTextToProcedure(version.extractedText);
  await prisma.$transaction(async (tx) => {
    await persistStructuredContent(tx, version.id, parsed);
    await writeSigAuditLog(tx, {
      documentId,
      versionId: version.id,
      action: "CONTENT_UPDATED",
      actorId,
      notes: "Estructura Alfa (secciones fijas + tabla de actividades) desde archivo",
    });
  });
  return getSigProcedureContent(documentId);
}

export async function publishProcedureContentVersion(
  documentId: string,
  actorId: string,
  input: ProcedureBodyInput
) {
  const changeSummary = input.changeSummary?.trim();
  if (!changeSummary) throw new Error("Indique el resumen de cambios");
  if (!input.stages?.length && !input.activities?.length) {
    throw new Error("Agregue contenido de secciones o actividades");
  }

  const assignedApprover = await assertSigApproverUser(input.assignedApproverId);

  let flowchartMeta: {
    fileName: string;
    mimeType: string;
    storagePath: string;
    fileSizeBytes: number;
  } | null = null;

  if (input.flowchart) {
    if (!FLOWCHART_MIMES.has(input.flowchart.mimeType)) {
      throw new Error("El diagrama debe ser PNG, JPEG, WebP o GIF");
    }
    if (input.flowchart.size > MAX_FLOWCHART_BYTES) {
      throw new Error("Diagrama demasiado grande (máx. 15 MB)");
    }
  }

  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: {
      versions: { orderBy: { versionNumber: "desc" }, take: 1 },
      currentVersion: { include: { procedureBody: true } },
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

  // Normalize stages to fixed keys
  const keyedStages: ProcedureStageInput[] = ALFA_FIXED_SECTIONS.map((def) => {
    const found = input.stages.find(
      (s) => s.sectionKey === def.key || matchSectionKeyFromTitle(s.title) === def.key
    );
    return {
      sectionKey: def.key,
      title: displaySectionTitle(def.key),
      body: found?.body ?? "",
      responsible: found?.responsible ?? null,
    };
  });

  const byKey = Object.fromEntries(
    keyedStages.filter((s) => s.sectionKey).map((s) => [s.sectionKey!, s.body])
  ) as Partial<Record<AlfaSectionKey, string>>;

  const parsed = {
    body: {
      objective: trimText(input.objective) ?? byKey.OBJETIVO_GENERAL ?? null,
      scope: trimText(input.scope) ?? byKey.ALCANCE ?? null,
      responsibilities: trimText(input.responsibilities) ?? byKey.RESPONSABILIDADES ?? null,
      definitions: trimText(input.definitions) ?? byKey.DEFINICIONES ?? null,
    },
    stages: keyedStages,
    activities: input.activities ?? [],
  };

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

    if (input.flowchart) {
      const dir = sigDocumentDir(documentId);
      await mkdir(dir, { recursive: true });
      const safe = input.flowchart.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
      const storedName = `flowchart_v${nextNumber}_${Date.now()}_${safe}`;
      const rel = storagePathForSigFile(documentId, storedName);
      await writeFile(path.join(dir, path.basename(storedName)), input.flowchart.buffer);
      flowchartMeta = {
        fileName: input.flowchart.fileName.slice(0, 255),
        mimeType: input.flowchart.mimeType,
        storagePath: rel,
        fileSizeBytes: input.flowchart.size,
      };
    }

    const baseBody = base.procedureBody;
    await persistStructuredContent(
      tx,
      created.id,
      parsed,
      flowchartMeta,
      input.clearFlowchart === true,
      baseBody
        ? {
            flowchartFileName: baseBody.flowchartFileName,
            flowchartMimeType: baseBody.flowchartMimeType,
            flowchartStoragePath: baseBody.flowchartStoragePath,
            flowchartFileSizeBytes: baseBody.flowchartFileSizeBytes,
          }
        : null
    );

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
      metadata: {
        versionNumber: nextNumber,
        activities: parsed.activities.length,
        flowchart: Boolean(flowchartMeta),
      },
    });
    await writeSigAuditLog(tx, {
      documentId,
      versionId: created.id,
      action: "NEW_VERSION",
      actorId,
      notes: `Contenido procedimiento v${versionLabel}`,
      metadata: { versionNumber: nextNumber, contentOnly: true },
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
        data: { status: "IMPLEMENTED", reviewerId: actorId, reviewedAt: new Date() },
      });
    }

    return created;
  });

  return { version, procedure: await getSigProcedureContent(documentId) };
}

export async function getProcedureFlowchart(documentId: string) {
  const doc = await prisma.sigDocument.findUnique({
    where: { id: documentId },
    include: { currentVersion: { include: { procedureBody: true } } },
  });
  const body = doc?.currentVersion?.procedureBody;
  if (!body?.flowchartStoragePath || !body.flowchartMimeType) return null;
  return {
    storagePath: body.flowchartStoragePath,
    mimeType: body.flowchartMimeType,
    fileName: body.flowchartFileName ?? "diagrama-flujo",
  };
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

export { ALFA_FIXED_SECTIONS, displaySectionTitle };