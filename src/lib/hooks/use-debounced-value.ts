"use client";

import { useState, useEffect } from "react";

/**
 * Devuelve un valor que solo se actualiza tras `delay` ms de inactividad.
 * Útil para evitar fetch en cada keystroke de campos de búsqueda.
 */
export function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
