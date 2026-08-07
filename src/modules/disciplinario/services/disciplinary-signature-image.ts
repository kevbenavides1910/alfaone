/**
 * Prepara la imagen de firma para PDF: quita fondos claros/grises,
 * recorta márgenes vacíos y exporta PNG con transparencia.
 */
export async function prepareDisciplinarySignaturePng(
  bytes: Uint8Array,
): Promise<Uint8Array | null> {
  if (!bytes?.length) return null;

  try {
    const { createCanvas, loadImage } = await import("@napi-rs/canvas");
    const img = await loadImage(Buffer.from(bytes));
    const w = img.width;
    const h = img.height;
    if (w < 2 || h < 2) return null;

    const src = createCanvas(w, h);
    const sctx = src.getContext("2d");
    sctx.drawImage(img, 0, 0);
    const data = sctx.getImageData(0, 0, w, h);
    const px = data.data;

    // Estima el color de fondo desde las esquinas (JPEG con recuadro gris).
    const cornerSamples: number[] = [];
    for (const [cx, cy] of [
      [2, 2],
      [w - 3, 2],
      [2, h - 3],
      [w - 3, h - 3],
      [Math.floor(w / 2), 2],
      [2, Math.floor(h / 2)],
    ] as const) {
      if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
      const i = (cy * w + cx) * 4;
      cornerSamples.push(0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!);
    }
    const bgLuma =
      cornerSamples.length > 0
        ? cornerSamples.reduce((a, b) => a + b, 0) / cornerSamples.length
        : 200;

    for (let i = 0; i < px.length; i += 4) {
      const a = px[i + 3]!;
      if (a < 8) {
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
        px[i + 3] = 0;
        continue;
      }
      const r = px[i]!;
      const g = px[i + 1]!;
      const b = px[i + 2]!;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);
      const distBg = Math.abs(luma - bgLuma);

      // Fondo (gris/blanco del recuadro) → transparente
      if (chroma <= 28 && distBg <= 55) {
        px[i + 3] = 0;
        continue;
      }
      if (luma >= 168 && chroma <= 42) {
        px[i + 3] = 0;
        continue;
      }
      if (luma >= 140 && chroma <= 22) {
        px[i + 3] = 0;
        continue;
      }

      // Artefactos JPEG de color débil alrededor de la tinta
      if (luma >= 145 && chroma <= 55 && distBg <= 70) {
        px[i + 3] = 0;
        continue;
      }

      // Suaviza bordes semi-claros (anti-alias)
      if (luma >= 200 && chroma <= 60) {
        const fade = Math.max(0, Math.min(1, (235 - luma) / 35));
        px[i + 3] = Math.round(a * fade * (chroma / 60));
        continue;
      }

      // Refuerza tinta azul/oscura; atenúa ruido magenta débil
      const isInkLike = b >= r - 10 || luma < 120 || chroma >= 50;
      if (!isInkLike && luma > 130) {
        px[i + 3] = Math.round(a * 0.35);
      }
    }

    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const a = px[(y * w + x) * 4 + 3]!;
        if (a < 20) continue;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }

    if (maxX < minX || maxY < minY) return null;

    const pad = Math.max(6, Math.round(Math.min(w, h) * 0.025));
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad);
    maxY = Math.min(h - 1, maxY + pad);

    const cw = maxX - minX + 1;
    const ch = maxY - minY + 1;
    sctx.putImageData(data, 0, 0);

    const out = createCanvas(cw, ch);
    const octx = out.getContext("2d");
    octx.clearRect(0, 0, cw, ch);
    octx.drawImage(src, minX, minY, cw, ch, 0, 0, cw, ch);

    const png = out.toBuffer("image/png");
    return new Uint8Array(png);
  } catch {
    return null;
  }
}
