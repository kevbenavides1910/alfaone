"use client";

import { useSearchParams } from "next/navigation";

/** Lee ?tab= (y otros query params) reactivo a navegación cliente. Requiere Suspense en el árbol padre. */
export function useQueryTab(param = "tab"): string | null {
  const searchParams = useSearchParams();
  return searchParams.get(param);
}
