/** Checklist operativo de entrega de puesto (Centro de Monitoreo). */

export const ENTREGA_PUESTO_GROUPS: ReadonlyArray<readonly [string, readonly string[]]> = [
  [
    "Sistemas CCTV",
    [
      "Todas las cámaras están en línea",
      "No hay cámaras congeladas ni sin imagen",
      "NVR y grabación operativos",
      "Monitores y plataformas de visualización funcionando",
    ],
  ],
  [
    "Sistemas de alarmas",
    [
      "Centrales de alarmas en línea",
      "Recepción de eventos y señales funcionando",
      "Alarmas y fallas pendientes comunicadas",
    ],
  ],
  [
    "Sistemas operativos",
    [
      "Aperturas y cierres operativos",
      "Sistema de marcas y rutas GPS funcionando",
      "OSSIA VMS, Bycon y demás plataformas operativas",
      "Conexión a internet y red funcionando",
    ],
  ],
  [
    "Equipos e infraestructura",
    [
      "Computadoras y monitores funcionando",
      "UPS y respaldo eléctrico en condiciones normales",
      "Teléfonos y medios de comunicación operativos",
      "Área de trabajo limpia y ordenada",
    ],
  ],
  [
    "Pendientes y novedades",
    [
      "Incidencias registradas y actualizadas",
      "Pendientes comunicados al operador entrante",
      "Fallas técnicas notificadas a responsables",
      "Bitácoras y reportes actualizados",
    ],
  ],
];

export const ENTREGA_STATUSES = ["OK", "FALLA", "NA"] as const;
export type EntregaStatus = (typeof ENTREGA_STATUSES)[number];

export type EntregaCheck = {
  group: string;
  label: string;
  status: EntregaStatus;
};

export function entregaPuestoItems(): Array<{ group: string; label: string }> {
  return ENTREGA_PUESTO_GROUPS.flatMap(([group, labels]) => labels.map((label) => ({ group, label })));
}

export function fallaCount(checks: Array<{ status: string }>): number {
  return checks.filter((c) => c.status === "FALLA").length;
}

export function entregaResultado(checks: Array<{ status: string }>): string {
  const n = fallaCount(checks);
  return n ? `${n} falla(s) reportada(s)` : "Sin fallas reportadas";
}

export function validateEntrega(input: {
  fecha: string;
  hora: string;
  saliente: string;
  entrante: string;
  observaciones: string;
  checks: Array<{ group: string; label: string; status: string }>;
}): string {
  if (!input.fecha || !input.hora || !input.saliente.trim() || !input.entrante.trim()) {
    return "Complete fecha, hora y ambos operadores.";
  }
  const items = entregaPuestoItems();
  if (input.checks.length !== items.length) {
    return "El checklist no coincide con los puntos vigentes.";
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const check = input.checks[i];
    if (check.group !== item.group || check.label !== item.label) {
      return "El checklist no coincide con los puntos vigentes.";
    }
    if (!ENTREGA_STATUSES.includes(check.status as EntregaStatus)) {
      return "Debe verificar todos los puntos antes de guardar.";
    }
  }
  if (input.checks.some((c) => c.status === "FALLA") && !input.observaciones.trim()) {
    return "Describa las fallas o pendientes en observaciones.";
  }
  return "";
}
