const FINGER_LABELS: Record<number, string> = {
  0: "Pulgar derecho",
  1: "Índice derecho",
  2: "Medio derecho",
  3: "Anular derecho",
  4: "Meñique derecho",
  5: "Pulgar izquierdo",
  6: "Índice izquierdo",
  7: "Medio izquierdo",
  8: "Anular izquierdo",
  9: "Meñique izquierdo",
};

export function fingerLabel(fingerId: number): string {
  return FINGER_LABELS[fingerId] ?? `Dedo ${fingerId}`;
}
