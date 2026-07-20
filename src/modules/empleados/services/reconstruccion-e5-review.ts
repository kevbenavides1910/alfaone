/**
 * Revisión humana de contratos E5 reconstruidos desde NAF (borradores para re-firma).
 * Corpus bajo APP_DATA_ROOT/reconstruccion-e5 (o RECONSTRUCCION_E5_ROOT):
 * PDFs `E5_{noEmple}_BORRADOR.pdf`, MANIFIESTO.csv, empresas.json y revisiones.json.
 */
import { promises as fs } from "fs";
import path from "path";
import { appDataRoot } from "@/lib/storage/paths";
import { parseCsvRecords, detectCsvDelimiter, stripBom } from "@/modules/core/import/csv-read";

export type ReconstruccionEstado = "APROBADO" | "OBSERVADO";

export type ReconstruccionReview = {
  id: string;
  fileName: string;
  noEmple: string;
  estado: ReconstruccionEstado;
  observacion: string;
  reviewedBy?: string;
  reviewedAt?: string;
};

export type ReconstruccionItem = {
  id: string;
  fileName: string;
  sizeMb: number;
  noEmple: string;
  nombre: string;
  cia: string;
  empresa: string;
  puesto: string;
  fIngreso: string;
  /** Salario mínimo TOSCG impreso (según año de ingreso), formateado. */
  salario: string;
  /** Año de plantilla / salario aplicado (año de la fecha de ingreso). */
  anioPlantilla: string;
  /** Campos que quedaron en blanco en el PDF para completar a mano. */
  camposEnBlanco: string[];
  review: ReconstruccionReview | null;
};

export type ReconstruccionSummary = {
  total: number;
  aprobados: number;
  conObservaciones: number;
  pendientes: number;
};

function reviewRoot(): string {
  const fromEnv = process.env.RECONSTRUCCION_E5_ROOT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.join(appDataRoot(), "reconstruccion-e5");
}

function reviewsPath(): string {
  return path.join(reviewRoot(), "revisiones.json");
}

function safeId(fileName: string): string {
  return Buffer.from(fileName, "utf8").toString("base64url");
}

export function parseReconstruccionId(id: string): { fileName: string } | null {
  try {
    const fileName = Buffer.from(id, "base64url").toString("utf8");
    if (!fileName || fileName.includes("..") || fileName.includes("/") || fileName.includes("\\")) {
      return null;
    }
    if (!/^E5_\d+_BORRADOR\.pdf$/i.test(fileName)) return null;
    return { fileName };
  } catch {
    return null;
  }
}

async function loadReviews(): Promise<Record<string, ReconstruccionReview>> {
  try {
    const raw = await fs.readFile(reviewsPath(), "utf8");
    const data = JSON.parse(raw) as Record<string, ReconstruccionReview>;
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

async function saveReviews(map: Record<string, ReconstruccionReview>): Promise<void> {
  const root = reviewRoot();
  await fs.mkdir(root, { recursive: true });
  const tmp = reviewsPath() + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(map, null, 2), "utf8");
  await fs.rename(tmp, reviewsPath());
}

type ManifestRow = {
  noEmple: string;
  nombre: string;
  cia: string;
  empresa: string;
  puesto: string;
  fIngreso: string;
  camposEnBlanco: string[];
};

const BLANK_FIELD_LABELS: Record<string, string> = {
  tiene_correo: "Correo",
  tiene_direccion: "Dirección",
  tiene_estado_civil: "Estado civil",
  tiene_telefono: "Teléfono / WhatsApp",
};

async function loadManifest(): Promise<Record<string, ManifestRow>> {
  const out: Record<string, ManifestRow> = {};
  let text: string;
  try {
    text = await fs.readFile(path.join(reviewRoot(), "MANIFIESTO.csv"), "utf8");
  } catch {
    return out;
  }
  const raw = stripBom(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const firstLine = raw.split("\n", 1)[0] ?? "";
  const delim = detectCsvDelimiter(firstLine);
  const rows = parseCsvRecords(raw, delim);
  if (rows.length < 2) return out;
  const header = rows[0].map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  const iNoEmple = idx("NO_EMPLE");
  if (iNoEmple < 0) return out;
  const iNombre = idx("NOMBRE");
  const iCia = idx("CIA");
  const iEmpresa = idx("EMPRESA");
  const iPuesto = idx("PUESTO");
  const iFIngreso = idx("F_INGRESO");
  const blankCols = Object.keys(BLANK_FIELD_LABELS)
    .map((c) => ({ col: c, i: idx(c) }))
    .filter((x) => x.i >= 0);

  for (const row of rows.slice(1)) {
    const noEmple = (row[iNoEmple] ?? "").trim();
    if (!noEmple) continue;
    const camposEnBlanco = blankCols
      .filter((x) => (row[x.i] ?? "").trim().toUpperCase() === "NO")
      .map((x) => BLANK_FIELD_LABELS[x.col]);
    out[noEmple] = {
      noEmple,
      nombre: (iNombre >= 0 ? row[iNombre] : "") ?? "",
      cia: (iCia >= 0 ? row[iCia] : "") ?? "",
      empresa: (iEmpresa >= 0 ? row[iEmpresa] : "") ?? "",
      puesto: (iPuesto >= 0 ? row[iPuesto] : "") ?? "",
      fIngreso: (iFIngreso >= 0 ? row[iFIngreso] : "") ?? "",
      camposEnBlanco,
    };
  }
  return out;
}

async function loadSalarios(): Promise<Record<string, number>> {
  try {
    const raw = await fs.readFile(path.join(reviewRoot(), "empresas.json"), "utf8");
    const data = JSON.parse(raw) as { salarioMinimoTOSCG?: Record<string, unknown> };
    const src = data.salarioMinimoTOSCG ?? {};
    const out: Record<string, number> = {};
    for (const [year, monto] of Object.entries(src)) {
      if (typeof monto === "number") out[year] = monto;
    }
    return out;
  } catch {
    return {};
  }
}

function formatColones(n: number): string {
  return `₡${n.toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function listReconstruccionItems(): Promise<{
  root: string;
  items: ReconstruccionItem[];
  summary: ReconstruccionSummary;
}> {
  const root = reviewRoot();
  const [reviews, manifest, salarios] = await Promise.all([
    loadReviews(),
    loadManifest(),
    loadSalarios(),
  ]);

  let entries: string[] = [];
  try {
    entries = await fs.readdir(root);
  } catch {
    entries = [];
  }

  const items: ReconstruccionItem[] = [];
  for (const fileName of entries) {
    const m = /^E5_(\d+)_BORRADOR\.pdf$/i.exec(fileName);
    if (!m) continue;
    const full = path.join(root, fileName);
    let st;
    try {
      st = await fs.stat(full);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;

    const noEmple = m[1];
    const row = manifest[noEmple];
    const anio = row?.fIngreso ? row.fIngreso.slice(0, 4) : "";
    const salarioMonto = anio ? salarios[anio] : undefined;
    const id = safeId(fileName);
    items.push({
      id,
      fileName,
      sizeMb: Math.round((st.size / 1024 / 1024) * 100) / 100,
      noEmple,
      nombre: row?.nombre ?? "",
      cia: row?.cia ?? "",
      empresa: row?.empresa ?? "",
      puesto: row?.puesto ?? "",
      fIngreso: row?.fIngreso ?? "",
      salario: typeof salarioMonto === "number" ? formatColones(salarioMonto) : "",
      anioPlantilla: anio,
      camposEnBlanco: row?.camposEnBlanco ?? [],
      review: reviews[id] ?? null,
    });
  }

  items.sort((a, b) => a.noEmple.localeCompare(b.noEmple));

  const summary: ReconstruccionSummary = {
    total: items.length,
    aprobados: 0,
    conObservaciones: 0,
    pendientes: 0,
  };
  for (const it of items) {
    if (!it.review) summary.pendientes += 1;
    else if (it.review.estado === "APROBADO") summary.aprobados += 1;
    else summary.conObservaciones += 1;
  }

  return { root, items, summary };
}

export async function readReconstruccionPdf(id: string): Promise<{
  buf: Buffer;
  fileName: string;
} | null> {
  const parsed = parseReconstruccionId(id);
  if (!parsed) return null;
  const rootResolved = path.resolve(reviewRoot());
  const fullResolved = path.resolve(path.join(rootResolved, parsed.fileName));
  if (!fullResolved.startsWith(rootResolved + path.sep)) return null;
  try {
    const buf = await fs.readFile(fullResolved);
    return { buf, fileName: parsed.fileName };
  } catch {
    return null;
  }
}

export async function reviewReconstruccionItem(input: {
  id: string;
  estado: ReconstruccionEstado;
  observacion?: string;
  userEmail?: string;
}): Promise<ReconstruccionReview> {
  const parsed = parseReconstruccionId(input.id);
  if (!parsed) throw new Error("ID inválido");
  const full = path.join(reviewRoot(), parsed.fileName);
  await fs.access(full);

  const observacion = (input.observacion || "").trim();
  if (input.estado === "OBSERVADO" && !observacion) {
    throw new Error("La observación es requerida para marcar con observaciones");
  }

  const m = /^E5_(\d+)_BORRADOR\.pdf$/i.exec(parsed.fileName);
  const map = await loadReviews();
  const row: ReconstruccionReview = {
    id: input.id,
    fileName: parsed.fileName,
    noEmple: m?.[1] ?? "",
    estado: input.estado,
    observacion,
    reviewedBy: input.userEmail,
    reviewedAt: new Date().toISOString(),
  };
  map[input.id] = row;
  await saveReviews(map);
  return row;
}
