function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function splitAmount(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) {
    return [];
  }

  let assigned = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return roundMoney(total - assigned);
    }
    const share = roundMoney((total * weight) / weightSum);
    assigned += share;
    return share;
  });
}
