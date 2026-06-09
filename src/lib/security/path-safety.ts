import path from "path";

/** Resuelve ruta bajo root y rechaza path traversal. */
export function resolveUnderRoot(root: string, relative: string): string | null {
  const normalized = relative.replace(/\\/g, "/");
  if (normalized.includes("..") || normalized.startsWith("/")) {
    return null;
  }
  const abs = path.resolve(root, normalized);
  const rootResolved = path.resolve(root);
  if (!abs.startsWith(rootResolved + path.sep) && abs !== rootResolved) {
    return null;
  }
  return abs;
}
