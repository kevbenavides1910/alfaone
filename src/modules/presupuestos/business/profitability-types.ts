import type { TrafficLight } from "@/lib/utils/constants";

/** % ejecución, semáforo y monto de gasto por rubro. Sin I/O — seguro en el cliente. */
export type RubroTrafficSnapshot = {
  spend: number;
  /** Cargas sociales incluidas en spend (solo MO con nómina NAF). */
  cargasSocialesSpend?: number;
  usagePct: number;
  usagePctFormatted: number;
  trafficLight: TrafficLight;
};

export const EMPTY_RUBRO_TRAFFIC: RubroTrafficSnapshot = {
  spend: 0,
  usagePct: 0,
  usagePctFormatted: 0,
  trafficLight: "GREEN",
};
