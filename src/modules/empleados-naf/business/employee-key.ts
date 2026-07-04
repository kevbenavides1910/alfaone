/** Clave única compuesta NO_CIA + NO_EMPLE para réplica local. */
export function nafEmployeeSourceKey(noCia: string, noEmple: string): string {
  return `${noCia.trim()}-${noEmple.trim()}`;
}

export function parseNafEmployeeSourceKey(sourceKey: string): { noCia: string; noEmple: string } | null {
  const idx = sourceKey.indexOf("-");
  if (idx <= 0) return null;
  return {
    noCia: sourceKey.slice(0, idx),
    noEmple: sourceKey.slice(idx + 1),
  };
}
