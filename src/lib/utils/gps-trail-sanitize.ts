/** Solo cortar teleports GPS muy evidentes (varias cuadras de un salto). */
export const GPS_TRAIL_MAX_JUMP_METERS = 1000;

/** Velocidad claramente imposible (km/h). */
export const GPS_TRAIL_MAX_SPEED_KMH = 120;

/** Intervalo asumido si dos puntos comparten hora. */
export const GPS_TRAIL_ASSUMED_INTERVAL_MS = 60_000;

export type GpsCoord = {
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLat = lat2 - lat1;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

export function shouldBreakTrailSegment(prev: GpsCoord, curr: GpsCoord): boolean {
  const dist = haversineMeters(prev, curr);
  if (dist <= 12) return false;

  if (dist >= GPS_TRAIL_MAX_JUMP_METERS) return true;

  const prevMs = new Date(prev.recordedAt).getTime();
  const currMs = new Date(curr.recordedAt).getTime();
  const dtMs =
    Number.isFinite(prevMs) && Number.isFinite(currMs) && currMs > prevMs
      ? currMs - prevMs
      : GPS_TRAIL_ASSUMED_INTERVAL_MS;

  const speedKmh = (dist / 1000) / (dtMs / 3_600_000);
  return speedKmh > GPS_TRAIL_MAX_SPEED_KMH;
}

export function splitTrailIntoSegments<T extends GpsCoord>(points: T[]): T[][] {
  if (points.length === 0) return [];

  const segments: T[][] = [[points[0]]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    if (shouldBreakTrailSegment(prev, curr)) {
      segments.push([curr]);
    } else {
      segments[segments.length - 1].push(curr);
    }
  }

  return segments;
}

/**
 * Trazo para el mapa: prioriza linea continua; solo parte en saltos enormes.
 * Si el filtro fragmenta demasiado el recorrido, se dibuja el trazo completo.
 */
export function drawableTrailSegments<T extends GpsCoord>(points: T[]): T[][] {
  if (points.length < 2) return [];

  const split = splitTrailIntoSegments(points).filter((segment) => segment.length >= 2);
  if (split.length === 0) return [points];

  const coveredPoints = split.reduce((total, segment) => total + segment.length, 0);
  const tooFragmented = split.length >= Math.max(3, Math.ceil(points.length * 0.25));
  const tooMuchHidden = coveredPoints < Math.ceil(points.length * 0.7);

  if (tooFragmented || tooMuchHidden) return [points];

  return split;
}
