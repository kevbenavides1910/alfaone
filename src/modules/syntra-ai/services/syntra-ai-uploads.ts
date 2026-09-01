const MAX_CHAT_UPLOADS = 4;
const MAX_UPLOAD_BYTES = 900 * 1024;
const MAX_DOC_CHARS = 12_000;

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
]);

export type ChatUploadInput = {
  name?: string;
  mimetype?: string;
  data?: string;
};

export type ChatUploadContext = {
  ok: boolean;
  prompt: string;
  imageParts: Array<{ type: "image_url"; image_url: { url: string } }>;
  labels: string[];
  imageCount: number;
  docCount: number;
  errors: string[];
  accepted: number;
};

function decodeBase64(data: string): Buffer {
  let b64 = data.trim();
  if (b64.includes(",") && b64.startsWith("data:")) {
    b64 = b64.split(",", 2)[1] ?? "";
  }
  b64 = b64.replace(/\s+/g, "");
  return Buffer.from(b64, "base64");
}

function sniffMime(raw: Buffer, fallback: string): string {
  if (raw.length >= 4 && raw.subarray(0, 4).toString() === "%PDF") return "application/pdf";
  if (raw.length >= 3 && raw[0] === 0xff && raw[1] === 0xd8 && raw[2] === 0xff) return "image/jpeg";
  if (raw.length >= 8 && raw.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  return fallback;
}

function extractTextBytes(raw: Buffer, mime: string, name: string): string {
  if (mime.startsWith("text/") || mime === "application/json" || mime === "application/xml") {
    return raw.toString("utf-8").replace(/\s+/g, " ").trim();
  }
  if (mime === "application/pdf") {
    const asText = raw.toString("latin1");
    const chunks = [...asText.matchAll(/\(([^\\)]+)\)/g)]
      .map((m) => m[1])
      .filter((s) => s.length > 2 && /[a-zA-Záéíóúñ]/.test(s))
      .join(" ");
    if (chunks.length > 40) return chunks.slice(0, MAX_DOC_CHARS);
    return `[PDF ${name}: texto no extraído completamente; pida al usuario detalle o use visión si es imagen escaneada]`;
  }
  return "";
}

export function prepareChatUploads(uploads: ChatUploadInput[] | null | undefined): ChatUploadContext {
  if (!uploads?.length) {
    return {
      ok: true,
      prompt: "",
      imageParts: [],
      labels: [],
      imageCount: 0,
      docCount: 0,
      errors: [],
      accepted: 0,
    };
  }

  const errors: string[] = [];
  const labels: string[] = [];
  const imageParts: ChatUploadContext["imageParts"] = [];
  const docChunks: string[] = [];
  let totalChars = 0;
  let accepted = 0;

  for (const item of uploads.slice(0, MAX_CHAT_UPLOADS)) {
    const name = (item.name || "archivo").trim().slice(0, 180) || "archivo";
    let mime = (item.mimetype || "").toLowerCase().split(";")[0].trim();
    const data = item.data || "";
    if (!data) {
      errors.push(`«${name}»: sin datos.`);
      continue;
    }
    let raw: Buffer;
    try {
      raw = decodeBase64(data);
    } catch {
      errors.push(`«${name}»: base64 inválido.`);
      continue;
    }
    if (raw.length > MAX_UPLOAD_BYTES) {
      errors.push(`«${name}» supera ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB.`);
      continue;
    }
    if (!mime) mime = sniffMime(raw, "application/octet-stream");

    if (IMAGE_MIMES.has(mime) || mime.startsWith("image/")) {
      const normalized = mime === "image/jpg" ? "image/jpeg" : mime;
      if (!IMAGE_MIMES.has(normalized) && normalized !== "image/jpeg") {
        errors.push(`«${name}»: imagen no soportada (${mime}).`);
        continue;
      }
      const dataUrl = `data:${normalized};base64,${raw.toString("base64")}`;
      imageParts.push({ type: "image_url", image_url: { url: dataUrl } });
      labels.push(name);
      accepted += 1;
      continue;
    }

    if (
      mime === "application/pdf" ||
      mime.startsWith("text/") ||
      mime === "application/json" ||
      mime === "application/xml"
    ) {
      const text = extractTextBytes(raw, mime, name);
      if (!text) {
        errors.push(`«${name}»: no se pudo extraer texto.`);
        continue;
      }
      const take = text.slice(0, Math.max(400, MAX_DOC_CHARS - totalChars));
      totalChars += take.length;
      docChunks.push(`- ${name} (${mime}): ${take}`);
      labels.push(name);
      accepted += 1;
      if (totalChars >= MAX_DOC_CHARS) break;
      continue;
    }

    errors.push(`«${name}»: tipo no permitido (${mime}). Use imagen, PDF o texto.`);
  }

  if (uploads.length > MAX_CHAT_UPLOADS) {
    errors.push(`Solo se procesan los primeros ${MAX_CHAT_UPLOADS} archivos.`);
  }

  let prompt = "";
  if (docChunks.length) {
    prompt =
      "### Archivos adjuntos en este mensaje\nUsa SOLO este contenido para lo que digan los documentos. Cita el nombre del archivo.\n" +
      docChunks.join("\n");
  }

  return {
    ok: true,
    prompt,
    imageParts,
    labels,
    imageCount: imageParts.length,
    docCount: docChunks.length,
    errors,
    accepted,
  };
}

export function buildUserMessageWithUploads(
  message: string,
  uploadCtx: ChatUploadContext,
): { role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> } {
  let text = (message || "").trim() || "(sin texto; revise los adjuntos)";
  if (uploadCtx.labels.length) {
    text = `${text}\n\n[Adjuntos: ${uploadCtx.labels.join(", ")}]`;
  }
  if (!uploadCtx.imageParts.length) {
    return { role: "user", content: text };
  }
  return {
    role: "user",
    content: [{ type: "text", text }, ...uploadCtx.imageParts],
  };
}
