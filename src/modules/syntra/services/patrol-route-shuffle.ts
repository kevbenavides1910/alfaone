/** Mezcla determinística: mismo orden todo el día para un dispositivo/ruta; distinto cada día. */
export function shuffleWithSeed<T>(items: T[], seed: string): T[] {
  if (items.length <= 1) return [...items];

  const out = [...items];
  let state = hashSeed(seed);

  for (let i = out.length - 1; i > 0; i--) {
    state = mulberry32(state);
    const j = Math.floor(nextFloat(state) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(a: number): number {
  let t = (a + 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
}

function nextFloat(state: number): number {
  return mulberry32(state) / 0x100000000;
}
