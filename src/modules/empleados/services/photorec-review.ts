/**
 * Revisión humana de PDFs PhotoRec (recuperación expediente).
 * Corpus bajo APP_DATA_ROOT/photorec-revision (o PHOTOREC_REVIEW_ROOT).
 */
import { promises as fs } from "fs";
import path from "path";
import { appDataRoot } from "@/lib/storage/paths";
import { padNoEmple, expedientePdfWritePath, expedienteTipoDir, pickBestExpedientePdfFilename } from "@/modules/expediente-digital/business/paths";
import {
  findExpedientePdfByPrefix,
  fetchExpedienteSmbFile,
  isExpedienteSmbConfigured,
  listExpedienteTipoFilenames,
} from "@/modules/expediente-digital/services/smb-expediente";
import { uploadExpedienteDocumento } from "@/modules/expediente-digital/services/person-dossier";
import { prisma } from "@/modules/core/db/prisma";

export const PHOTOREC_FOLDERS = [
  "00_todos_contratos_pendientes",
  "01_contratos_sin_empleado",
  "02_posibles_contratos_otros",
  "06_otros_grandes",
] as const;

export type PhotorecFolder = (typeof PHOTOREC_FOLDERS)[number];

export type PhotorecTipo =
  | "E5"
  | "E20"
  | "E28"
  | "E59"
  | "E22"
  | "E79"
  | "E7"
  | "OTRO"
  | "BASURA"
  | "PENDIENTE";

export type PhotorecClassification = {
  id: string;
  folder: string;
  fileName: string;
  tipo: PhotorecTipo;
  noEmple: string;
  cedula: string;
  nombre: string;
  notas: string;
  classifiedBy?: string;
  classifiedAt?: string;
};

export type PhotorecSuggestionCandidate = {
  score: number;
  noEmple: string;
  cedula: string;
  nombre: string;
  overlap?: string;
};

export type PhotorecSuggestion = {
  id: string;
  folder: string;
  fileName: string;
  extractedName: string;
  confidence: "alta" | "media" | "baja" | string;
  topScore: number;
  kind?: "missing_e5" | "probable_duplicate" | string;
  existing?: {
    noEmple: string;
    cedula: string;
    nombre: string;
    estado?: string;
    hasE5?: boolean;
  };
  candidates: PhotorecSuggestionCandidate[];
};

export type PhotorecItem = {
  id: string;
  folder: string;
  fileName: string;
  sizeMb: number;
  mtimeMs: number;
  classification: PhotorecClassification | null;
  suggestion: PhotorecSuggestion | null;
};

function reviewRoot(): string {
  const fromEnv = process.env.PHOTOREC_REVIEW_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(appDataRoot(), "photorec-revision");
}

function classificationsPath(): string {
  return path.join(reviewRoot(), "classifications.json");
}

function suggestionsPath(): string {
  return path.join(reviewRoot(), "suggestions.json");
}

async function loadSuggestions(): Promise<Record<string, PhotorecSuggestion>> {
  try {
    const raw = await fs.readFile(suggestionsPath(), "utf8");
    const data = JSON.parse(raw || "{}") as {
      byId?: Record<string, PhotorecSuggestion>;
      byFileName?: Record<string, PhotorecSuggestion>;
    };
    if (data.byId && Object.keys(data.byId).length) return data.byId;
    if (data.byFileName) {
      const byId: Record<string, PhotorecSuggestion> = {};
      for (const s of Object.values(data.byFileName)) {
        if (s?.id) byId[s.id] = s;
      }
      return byId;
    }
    return {};
  } catch {
    return {};
  }
}

function safeId(folder: string, fileName: string): string {
  return Buffer.from(`${folder}/${fileName}`, "utf8").toString("base64url");
}

export function parsePhotorecId(id: string): { folder: string; fileName: string } | null {
  try {
    const raw = Buffer.from(id, "base64url").toString("utf8");
    const slash = raw.indexOf("/");
    if (slash <= 0) return null;
    const folder = raw.slice(0, slash);
    const fileName = raw.slice(slash + 1);
    if (!folder || !fileName || fileName.includes("..") || fileName.includes("/")) return null;
    if (!PHOTOREC_FOLDERS.includes(folder as PhotorecFolder)) return null;
    if (!fileName.toLowerCase().endsWith(".pdf")) return null;
    return { folder, fileName };
  } catch {
    return null;
  }
}

async function loadClassifications(): Promise<Record<string, PhotorecClassification>> {
  try {
    const raw = await fs.readFile(classificationsPath(), "utf8");
    const data = JSON.parse(raw) as Record<string, PhotorecClassification>;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function saveClassifications(map: Record<string, PhotorecClassification>): Promise<void> {
  const root = reviewRoot();
  await fs.mkdir(root, { recursive: true });
  const tmp = classificationsPath() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(map, null, 2), "utf8");
  await fs.rename(tmp, classificationsPath());
}

export async function listPhotorecReviewItems(opts?: {
  folder?: string;
  onlyPending?: boolean;
  onlySuggested?: boolean;
  minConfidence?: "alta" | "media" | "baja";
  suggestionKind?: "all" | "missing_e5" | "probable_duplicate";
}): Promise<{ root: string; items: PhotorecItem[]; summary: Record<string, number> }> {
  const root = reviewRoot();
  const map = await loadClassifications();
  const suggestions = await loadSuggestions();
  const items: PhotorecItem[] = [];
  const folders = opts?.folder
    ? PHOTOREC_FOLDERS.filter((f) => f === opts.folder)
    : [...PHOTOREC_FOLDERS];

  const confRank: Record<string, number> = { alta: 3, media: 2, baja: 1 };
  const minRank = opts?.minConfidence ? confRank[opts.minConfidence] ?? 1 : 1;

  for (const folder of folders) {
    const dir = path.join(root, folder);
    let entries: string[] = [];
    try {
      entries = await fs.readdir(dir);
    } catch {
      continue;
    }
    for (const fileName of entries) {
      if (!fileName.toLowerCase().endsWith(".pdf")) continue;
      const full = path.join(dir, fileName);
      let st;
      try {
        st = await fs.stat(full);
      } catch {
        continue;
      }
      if (!st.isFile()) continue;
      const id = safeId(folder, fileName);
      const classification = map[id] ?? null;
      if (opts?.onlyPending && classification && classification.tipo !== "PENDIENTE") {
        continue;
      }
      const suggestion = suggestions[id] ?? null;
      if (opts?.onlySuggested && !suggestion) continue;
      if (
        suggestion &&
        opts?.suggestionKind &&
        opts.suggestionKind !== "all" &&
        (suggestion.kind || "missing_e5") !== opts.suggestionKind
      ) {
        continue;
      }
      if (
        suggestion &&
        opts?.minConfidence &&
        (confRank[suggestion.confidence] ?? 0) < minRank
      ) {
        continue;
      }
      items.push({
        id,
        folder,
        fileName,
        sizeMb: Math.round((st.size / 1024 / 1024) * 100) / 100,
        mtimeMs: st.mtimeMs,
        classification,
        suggestion,
      });
    }
  }

  items.sort((a, b) => {
    const sa = a.suggestion ? confRank[a.suggestion.confidence] ?? 0 : 0;
    const sb = b.suggestion ? confRank[b.suggestion.confidence] ?? 0 : 0;
    if (sa !== sb) return sb - sa;
    if (a.suggestion && b.suggestion && a.suggestion.topScore !== b.suggestion.topScore) {
      return b.suggestion.topScore - a.suggestion.topScore;
    }
    if (a.folder !== b.folder) {
      return (
        PHOTOREC_FOLDERS.indexOf(a.folder as PhotorecFolder) -
        PHOTOREC_FOLDERS.indexOf(b.folder as PhotorecFolder)
      );
    }
    return b.sizeMb - a.sizeMb;
  });

  const summary: Record<string, number> = {
    total: items.length,
    pendientes: 0,
    E5: 0,
    otros: 0,
    conSugerencia: 0,
    sugerenciaAlta: 0,
    sugerenciaMedia: 0,
  };
  for (const it of items) {
    const t = it.classification?.tipo;
    if (!t || t === "PENDIENTE") summary.pendientes += 1;
    else if (t === "E5") summary.E5 += 1;
    else summary.otros += 1;
    if (it.suggestion) {
      summary.conSugerencia += 1;
      if (it.suggestion.confidence === "alta") summary.sugerenciaAlta += 1;
      else if (it.suggestion.confidence === "media") summary.sugerenciaMedia += 1;
    }
  }

  return { root, items, summary };
}

export async function readPhotorecPdf(id: string): Promise<{
  buf: Buffer;
  fileName: string;
} | null> {
  const parsed = parsePhotorecId(id);
  if (!parsed) return null;
  const full = path.join(reviewRoot(), parsed.folder, parsed.fileName);
  const rootResolved = path.resolve(reviewRoot());
  const fullResolved = path.resolve(full);
  if (!fullResolved.startsWith(rootResolved + path.sep)) return null;
  try {
    const buf = await fs.readFile(fullResolved);
    return { buf, fileName: parsed.fileName };
  } catch {
    return null;
  }
}

export async function classifyPhotorecItem(input: {
  id: string;
  tipo: PhotorecTipo;
  noEmple?: string;
  cedula?: string;
  nombre?: string;
  notas?: string;
  userEmail?: string;
}): Promise<PhotorecClassification> {
  const parsed = parsePhotorecId(input.id);
  if (!parsed) throw new Error("ID inválido");
  const full = path.join(reviewRoot(), parsed.folder, parsed.fileName);
  await fs.access(full);

  const map = await loadClassifications();
  const row: PhotorecClassification = {
    id: input.id,
    folder: parsed.folder,
    fileName: parsed.fileName,
    tipo: input.tipo,
    noEmple: (input.noEmple || "").trim(),
    cedula: (input.cedula || "").trim(),
    nombre: (input.nombre || "").trim(),
    notas: (input.notas || "").trim(),
    classifiedBy: input.userEmail,
    classifiedAt: new Date().toISOString(),
  };
  map[input.id] = row;
  await saveClassifications(map);

  // Also append to a simple CSV for ops / Excel handoff
  const csvPath = path.join(reviewRoot(), "99_indice", "clasificaciones_alfaone.csv");
  await fs.mkdir(path.dirname(csvPath), { recursive: true });
  let needHeader = false;
  try {
    await fs.access(csvPath);
  } catch {
    needHeader = true;
  }
  const line = [
    row.id,
    row.folder,
    row.fileName,
    row.tipo,
    row.noEmple,
    row.cedula,
    `"${row.nombre.replace(/"/g, '""')}"`,
    `"${row.notas.replace(/"/g, '""')}"`,
    row.classifiedBy || "",
    row.classifiedAt || "",
  ].join(";");
  if (needHeader) {
    await fs.writeFile(
      csvPath,
      "id;folder;fileName;tipo;noEmple;cedula;nombre;notas;classifiedBy;classifiedAt\n" + line + "\n",
      "utf8",
    );
  } else {
    await fs.appendFile(csvPath, line + "\n", "utf8");
  }

  return row;
}

export type ApplyE5Status = "applied" | "skipped_exists" | "error";

export type ApplyE5Result = {
  status: ApplyE5Status;
  message: string;
  classification: PhotorecClassification | null;
  remotePath?: string;
  existingFile?: string;
};

export type LiveE5Status = {
  noEmple: string;
  hasE5: boolean;
  remotePath: string | null;
};

/**
 * Indica si el empleado ya tiene contrato E5 en el expediente vivo
 * (solo lista/existencia; no descarga el PDF).
 */
export async function getLiveE5Status(noEmpleRaw: string): Promise<LiveE5Status> {
  const noEmple = padNoEmple(noEmpleRaw.trim());
  if (!noEmple) {
    return { noEmple: "", hasE5: false, remotePath: null };
  }
  if (!isExpedienteSmbConfigured()) {
    return { noEmple, hasE5: false, remotePath: null };
  }
  const byPrefix = await findExpedientePdfByPrefix("E5", noEmple);
  return {
    noEmple,
    hasE5: Boolean(byPrefix),
    remotePath: byPrefix,
  };
}

/** Varios códigos con una sola listada del directorio E5. */
export async function getLiveE5StatusMany(
  codes: string[],
): Promise<Record<string, LiveE5Status>> {
  const unique = Array.from(
    new Set(codes.map((c) => c.trim()).filter(Boolean)),
  );
  const out: Record<string, LiveE5Status> = {};
  if (!unique.length || !isExpedienteSmbConfigured()) {
    for (const c of unique) {
      const noEmple = padNoEmple(c);
      out[c] = { noEmple, hasE5: false, remotePath: null };
    }
    return out;
  }

  const dirRel = expedienteTipoDir("E5");
  const names = (await listExpedienteTipoFilenames("E5")) ?? [];
  for (const c of unique) {
    const noEmple = padNoEmple(c);
    const file = pickBestExpedientePdfFilename(names, noEmple);
    out[c] = {
      noEmple,
      hasE5: Boolean(file),
      remotePath: file ? `${dirRel}/${file}` : null,
    };
  }
  return out;
}

/**
 * Clasifica el PDF como E5 y lo copia al expediente digital vivo
 * (`EMPLEADOS/E5/{noEmple}.pdf`) sin sobrescribir si ya existe.
 */
export async function applyPhotorecAsE5(input: {
  id: string;
  noEmple: string;
  cedula?: string;
  nombre?: string;
  notas?: string;
  userEmail?: string;
}): Promise<ApplyE5Result> {
  const noEmple = padNoEmple(input.noEmple.trim());
  if (!noEmple) {
    return {
      status: "error",
      message: "Código de empleado requerido",
      classification: null,
    };
  }

  const parsed = parsePhotorecId(input.id);
  if (!parsed) {
    return { status: "error", message: "ID inválido", classification: null };
  }

  const pdf = await readPhotorecPdf(input.id);
  if (!pdf) {
    return {
      status: "error",
      message: "No se pudo leer el PDF de revisión",
      classification: null,
    };
  }

  let cedula = (input.cedula || "").trim();
  let nombre = (input.nombre || "").trim();
  if (!cedula || !nombre) {
    const emp = await prisma.nafEmployee.findFirst({
      where: {
        OR: [{ noEmple }, { noEmple: input.noEmple.trim() }],
      },
      select: { cedula: true, nombre: true, noEmple: true },
      orderBy: { estado: "asc" },
    });
    if (emp) {
      if (!cedula) cedula = (emp.cedula || "").trim();
      if (!nombre) nombre = (emp.nombre || "").trim();
    }
  }

  if (!cedula) {
    return {
      status: "error",
      message: "No hay cédula para el empleado; no se puede registrar en expediente digital",
      classification: null,
    };
  }

  if (!isExpedienteSmbConfigured()) {
    return {
      status: "error",
      message:
        "Expediente digital no configurado (EXPEDIENTE_FS_ROOT / credenciales SMB)",
      classification: null,
    };
  }

  const writePath = expedientePdfWritePath("E5", noEmple);
  const existingByPath = await fetchExpedienteSmbFile(writePath);
  const existingByPrefix = existingByPath
    ? writePath
    : await findExpedientePdfByPrefix("E5", noEmple);

  const classifyRow = async (extraNotas?: string) =>
    classifyPhotorecItem({
      id: input.id,
      tipo: "E5",
      noEmple,
      cedula,
      nombre,
      notas: [input.notas, extraNotas].filter(Boolean).join(" · "),
      userEmail: input.userEmail,
    });

  if (existingByPrefix) {
    const classification = await classifyRow(
      `E5 vivo ya existía (${existingByPrefix}); no se sobrescribió`,
    );
    return {
      status: "skipped_exists",
      message: `Ya existe E5 en expediente (${existingByPrefix}). Clasificación guardada; archivo vivo no modificado.`,
      classification,
      existingFile: existingByPrefix,
      remotePath: existingByPrefix,
    };
  }

  try {
    const uploaded = await uploadExpedienteDocumento({
      cedulaRaw: cedula,
      tipoDoc: "E5",
      fileBuffer: pdf.buf,
      fileName: pdf.fileName,
      noEmple,
      actor: input.userEmail?.slice(0, 100) || "ALFAONE-PHOTOREC",
    });
    const classification = await classifyRow(`Aplicado a expediente: ${uploaded.remotePath}`);
    return {
      status: "applied",
      message: `Contrato E5 aplicado a ${noEmple} (${uploaded.remotePath})`,
      classification,
      remotePath: uploaded.remotePath,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      status: "error",
      message: msg,
      classification: null,
    };
  }
}
