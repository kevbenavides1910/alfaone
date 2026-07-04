import { haversineMeters, type GpsCoord } from "@/lib/utils/gps-trail-sanitize";

export type RoadPathPoint = { latitude: number; longitude: number };

/** Hueco real de señal: no trazar carretera a traves del vacio. */
const GAP_TIME_MS = 25 * 60 * 1000;
const GAP_DISTANCE_M = 650;
const PAIR_ROUTE_MIN_M = 55;
const OSRM_TIMEOUT_MS = 12_000;
const OSRM_MAX_MATCH_POINTS = 90;

function osrmBaseUrl(): string {
  return (process.env.OSRM_BASE_URL ?? "https://router.project-osrm.org").replace(/\/+$/, "");
}

function splitAtSignalGaps<T extends GpsCoord>(points: T[]): T[][] {
  if (points.length === 0) return [];

  const segments: T[][] = [[points[0]]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const dist = haversineMeters(prev, curr);
    const prevMs = new Date(prev.recordedAt).getTime();
    const currMs = new Date(curr.recordedAt).getTime();
    const dtMs =
      Number.isFinite(prevMs) && Number.isFinite(currMs) && currMs > prevMs
        ? currMs - prevMs
        : 0;

    const isGap = dist >= GAP_DISTANCE_M || dtMs >= GAP_TIME_MS;
    if (isGap) {
      segments.push([curr]);
    } else {
      segments[segments.length - 1].push(curr);
    }
  }

  return segments.filter((segment) => segment.length > 0);
}

function coordsToPath(coords: [number, number][]): RoadPathPoint[] {
  return coords.map(([latitude, longitude]) => ({ latitude, longitude }));
}

function appendPath(target: RoadPathPoint[], chunk: RoadPathPoint[]) {
  if (chunk.length === 0) return;
  if (target.length === 0) {
    target.push(...chunk);
    return;
  }
  const last = target[target.length - 1];
  const first = chunk[0];
  if (
    Math.abs(last.latitude - first.latitude) < 1e-7 &&
    Math.abs(last.longitude - first.longitude) < 1e-7
  ) {
    target.push(...chunk.slice(1));
  } else {
    target.push(...chunk);
  }
}

async function fetchOsrmJson(url: string): Promise<Record<string, unknown> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function geometryFromOsrm(data: Record<string, unknown> | null): RoadPathPoint[] {
  if (!data || data.code !== "Ok") return [];

  const routes = data.routes as { geometry?: { coordinates?: [number, number][] } }[] | undefined;
  const routeGeom = routes?.[0]?.geometry?.coordinates;
  if (routeGeom?.length) {
    return coordsToPath(routeGeom.map(([lng, lat]) => [lat, lng]));
  }

  const matchings = data.matchings as { geometry?: { coordinates?: [number, number][] } }[] | undefined;
  const matchGeom = matchings?.[0]?.geometry?.coordinates;
  if (matchGeom?.length) {
    return coordsToPath(matchGeom.map(([lng, lat]) => [lat, lng]));
  }

  return [];
}

async function osrmRoutePair(from: GpsCoord, to: GpsCoord): Promise<RoadPathPoint[]> {
  const url =
    `${osrmBaseUrl()}/route/v1/foot/` +
    `${from.longitude},${from.latitude};${to.longitude},${to.latitude}` +
    "?overview=full&geometries=geojson&steps=false";
  const snapped = geometryFromOsrm(await fetchOsrmJson(url));
  if (snapped.length >= 2) return snapped;
  return [
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: to.latitude, longitude: to.longitude },
  ];
}

async function snapSegment<T extends GpsCoord>(segment: T[]): Promise<RoadPathPoint[]> {
  if (segment.length < 2) {
    return segment.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
  }

  if (segment.length > OSRM_MAX_MATCH_POINTS) {
    const merged: RoadPathPoint[] = [];
    for (let i = 0; i < segment.length; i += OSRM_MAX_MATCH_POINTS - 1) {
      const chunk = segment.slice(i, i + OSRM_MAX_MATCH_POINTS);
      const part = await snapSegment(chunk);
      appendPath(merged, part);
    }
    return merged;
  }

  const coordStr = segment.map((p) => `${p.longitude},${p.latitude}`).join(";");
  const matchUrl =
    `${osrmBaseUrl()}/match/v1/foot/${coordStr}` +
    "?overview=full&geometries=geojson&steps=false&tidy=true";
  const matched = geometryFromOsrm(await fetchOsrmJson(matchUrl));
  if (matched.length >= 2) return matched;

  const merged: RoadPathPoint[] = [];
  for (let i = 0; i < segment.length - 1; i += 1) {
    const from = segment[i];
    const to = segment[i + 1];
    const dist = haversineMeters(from, to);
    if (dist < PAIR_ROUTE_MIN_M) {
      if (merged.length === 0) {
        merged.push({ latitude: from.latitude, longitude: from.longitude });
      }
      merged.push({ latitude: to.latitude, longitude: to.longitude });
      continue;
    }
    const leg = await osrmRoutePair(from, to);
    appendPath(merged, leg);
  }
  return merged;
}

/** Genera trazos por calles (OSRM foot) respetando huecos sin GPS. */
export async function buildRoadPathsForTrail<T extends GpsCoord>(
  points: T[],
): Promise<RoadPathPoint[][]> {
  const segments = splitAtSignalGaps(points);
  const paths: RoadPathPoint[][] = [];

  for (const segment of segments) {
    if (segment.length < 2) continue;
    const path = await snapSegment(segment);
    if (path.length >= 2) paths.push(path);
  }

  return paths;
}
