import { prisma } from "@/modules/core/db/prisma";

export type BandecoConsultaResult = {
  alarmNumber: number;
  finca: string;
  zona: string;
  motorizado: string;
  bodycam: string | null;
  grupoWsp: string | null;
  encargado: string | null;
  numeroEncargado: string | null;
  pantalla: number | null;
  camara: number | null;
  zonaExterna: string | null;
  pantalla2: number | null;
  camara2: number | null;
  camaraDescripcion: string | null;
  camara2Descripcion: string | null;
  mensajes: {
    activacion: string;
    pilas: string;
    riesgo: string;
    maxima: string;
  };
};

function buildActivationMessage(data: {
  finca: string;
  zona: string;
  motorizado: string;
  bodycam: string | null;
  grupoWsp: string | null;
}): string {
  const lines = [
    "🚨 *Buenas compañeros a este x11 tengo activación en:* 🚨",
    `Finca: ${data.finca}`,
    `Zona: ${data.zona}`,
    `Motorizado: ${data.motorizado}`,
  ];
  if (data.bodycam) lines.push(`Bodycam: ${data.bodycam}`);
  if (data.grupoWsp) lines.push(`Grupo de WhatsApp: ${data.grupoWsp}`);
  return lines.join("\n");
}

export async function consultarCodigoAlarma(alarmNumber: number): Promise<BandecoConsultaResult | null> {
  const code = await prisma.bandecoAlarmCode.findUnique({
    where: { alarmNumber },
    include: { pantalla: true },
  });
  if (!code || !code.isActive) return null;

  let camaraDescripcion: string | null = null;
  let camara2Descripcion: string | null = null;

  if (code.pantalla?.pantalla != null && code.pantalla.camara != null) {
    const cam = await prisma.bandecoCamara.findUnique({
      where: {
        pantallaNum_camaraNum: {
          pantallaNum: code.pantalla.pantalla,
          camaraNum: code.pantalla.camara,
        },
      },
    });
    camaraDescripcion = cam?.descripcion ?? null;
  }

  if (code.pantalla?.pantalla2 != null && code.pantalla.camara2 != null) {
    const cam2 = await prisma.bandecoCamara.findUnique({
      where: {
        pantallaNum_camaraNum: {
          pantallaNum: code.pantalla.pantalla2,
          camaraNum: code.pantalla.camara2,
        },
      },
    });
    camara2Descripcion = cam2?.descripcion ?? null;
  }

  const base = {
    finca: code.finca,
    zona: code.zona,
    motorizado: code.motorizado,
    bodycam: code.bodycam,
    grupoWsp: code.grupoWsp,
  };

  return {
    alarmNumber: code.alarmNumber,
    finca: code.finca,
    zona: code.zona,
    motorizado: code.motorizado,
    bodycam: code.bodycam,
    grupoWsp: code.grupoWsp,
    encargado: code.encargado,
    numeroEncargado: code.numeroEncargado,
    pantalla: code.pantalla?.pantalla ?? null,
    camara: code.pantalla?.camara ?? null,
    zonaExterna: code.pantalla?.zonaExterna ?? null,
    pantalla2: code.pantalla?.pantalla2 ?? null,
    camara2: code.pantalla?.camara2 ?? null,
    camaraDescripcion,
    camara2Descripcion,
    mensajes: {
      activacion: buildActivationMessage(base),
      pilas: "⚠️ *A este x11 solicito reporte de pilas compañeros* ⚠️",
      riesgo: [
        "*ACTIVACION DE RIESGO!!!*",
        "A este x11 tengo activacion en:",
        `Finca: ${code.finca}`,
        `Ubicación: ${code.zona}`,
        `Motorizado: ${code.motorizado}`,
        code.grupoWsp ? `WhatsApp: ${code.grupoWsp}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      maxima: [
        "*ACTIVACION DE ALERTA MAXIMA!!!*",
        "A este x11 tengo activacion en:",
        `Finca: ${code.finca}`,
        `Ubicación: ${code.zona}`,
        `Motorizado: ${code.motorizado}`,
        code.grupoWsp ? `WhatsApp: ${code.grupoWsp}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    },
  };
}

export function buildInformeActivacion(data: {
  fecha: string;
  hora: string;
  mensaje: string;
  finca: string;
  zona: string;
  estado: string;
  operadorName: string;
}): string {
  return [
    "INFORME DE ACTIVACIÓN",
    `Fecha: ${data.fecha}`,
    `Hora: ${data.hora}`,
    `Mensaje: ${data.mensaje}`,
    `Finca: ${data.finca}`,
    `Ubicación: ${data.zona}`,
    `Estado: ${data.estado}`,
    `Operador: ${data.operadorName}`,
    "Imagen de referencia:",
  ].join("\n");
}
