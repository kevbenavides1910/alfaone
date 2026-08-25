export const FINGER_SYSTEM_BASE = "/finger-system";

export function fingerSystemPath(segment?: string): string {
  if (!segment) return FINGER_SYSTEM_BASE;
  const clean = segment.replace(/^\//, "");
  return `${FINGER_SYSTEM_BASE}/${clean}`;
}
