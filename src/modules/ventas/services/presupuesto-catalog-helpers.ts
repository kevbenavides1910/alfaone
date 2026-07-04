export function totalGastosAdminMensual(
  gastos: Array<{ isActive: boolean; montoMensual: unknown }>
): number {
  return gastos
    .filter((g) => g.isActive)
    .reduce((s, g) => {
      const v = g.montoMensual;
      if (v == null) return s;
      if (typeof v === "number") return s + v;
      if (typeof v === "object" && v !== null && "toNumber" in v) {
        return s + (v as { toNumber: () => number }).toNumber();
      }
      return s + (Number(v) || 0);
    }, 0);
}
