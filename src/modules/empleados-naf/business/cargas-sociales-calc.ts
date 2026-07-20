export type CargasSocialesMontos = {
  cargasSocialesPct: number;
  cargasSocialesMonto: number;
  brutoConCargasSociales: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function applyCargasSociales(devengado: number, pct: number): CargasSocialesMontos {
  const cargasSocialesMonto = roundMoney(devengado * (pct / 100));
  return {
    cargasSocialesPct: pct,
    cargasSocialesMonto,
    brutoConCargasSociales: roundMoney(devengado + cargasSocialesMonto),
  };
}

export function weightedCargasSocialesPct(
  devengado: number,
  cargasSocialesMonto: number,
): number {
  if (devengado <= 0) return 0;
  return roundMoney((cargasSocialesMonto / devengado) * 100);
}
