import type { QuizSeedQuestion } from "./quiz-sig-induccion";

function choice(
  text: string,
  points: number,
  correctIndex: number,
  labels: string[]
): QuizSeedQuestion {
  return {
    text,
    type: "SINGLE_CHOICE",
    points,
    options: labels.map((label, index) => ({
      label,
      isCorrect: index === correctIndex,
    })),
  };
}

function tf(text: string, correctTrueFalse: boolean): QuizSeedQuestion {
  return {
    text,
    type: "TRUE_FALSE",
    points: 4,
    correctTrueFalse,
  };
}

function open(text: string, points: number): QuizSeedQuestion {
  return { text, type: "TEXT", points };
}

/**
 * Examen F-OP-10 v5. Clave de las cerradas según el formato vigente
 * (Ficha técnica, Funciones, Funciones del cartel, Documentos relacionados,
 * Contactos importantes) y el catálogo SIG.
 * La pregunta 11 no tiene opción correcta: el formato no fija la cantidad
 * de documentos relacionados. Queda sin calificar hasta marcarla en el editor.
 */
export const QUIZ_FOP10_MANUAL_PUESTO = {
  code: "F-OP-10",
  title: "Examen de evaluación – Conocimiento del Manual del Puesto",
  description:
    "Grupo Corporativo de Seguridad Alfa. Código F-OP-10, versión 5.\n\n" +
    "Instrucciones: Lea cuidadosamente cada pregunta. Marque la respuesta que considere correcta. " +
    "En las preguntas de verdadero o falso, seleccione la opción correspondiente. " +
    "Responda con claridad las preguntas abiertas.\n\n" +
    "Parte I. Estructura del manual del puesto — 20 puntos.\n" +
    "Parte II. Verdadero o falso — 20 puntos.\n" +
    "Parte III. Documentos relacionados — 25 puntos.\n" +
    "Parte IV. Identificación de documentos — 15 puntos.\n" +
    "Parte V. Conocimiento general — 20 puntos. Estas respuestas se revisan de forma manual y no entran al porcentaje automático.\n\n" +
    "Calificación sobre las preguntas cerradas con clave. Se requiere 80 % para aprobar. " +
    "Indique nombre, cédula, fecha y puesto asignado.",
  passScorePercent: 80,
  questions: [
    open("Nombre del colaborador", 0),
    open("Cédula", 0),
    open("Fecha", 0),
    open("Puesto asignado", 0),

    choice(
      "Parte I. Estructura del manual del puesto (20 puntos). 1. ¿Cuántas partes principales contiene el Manual del Puesto?",
      4,
      2,
      ["A. Tres partes.", "B. Cuatro partes.", "C. Cinco partes.", "D. Seis partes."]
    ),
    choice(
      "2. ¿Cuál de las siguientes opciones corresponde a la primera parte del Manual del Puesto?",
      4,
      1,
      [
        "A. Funciones del Puesto.",
        "B. Ficha Técnica del Puesto.",
        "C. Documentos Relacionados.",
        "D. Contactos Importantes.",
      ]
    ),
    choice(
      "3. ¿En cuál apartado se establecen las responsabilidades y tareas que debe cumplir el oficial?",
      4,
      2,
      [
        "A. Ficha Técnica del Puesto.",
        "B. Contactos Importantes.",
        "C. Funciones del Puesto.",
        "D. Documentos Relacionados.",
      ]
    ),
    choice(
      "4. ¿Cuál apartado contiene las obligaciones establecidas según las especificaciones técnicas del cartel?",
      4,
      0,
      [
        "A. Funciones del Puesto según Especificaciones Técnicas del Cartel.",
        "B. Contactos Importantes.",
        "C. Ficha Técnica del Puesto.",
        "D. Documentos Relacionados.",
      ]
    ),
    choice(
      "5. ¿En cuál apartado se encuentran los números telefónicos para comunicarse en caso de emergencias o situaciones operativas?",
      4,
      3,
      [
        "A. Funciones del Puesto.",
        "B. Documentos Relacionados.",
        "C. Ficha Técnica del Puesto.",
        "D. Contactos Importantes.",
      ]
    ),

    tf(
      "Parte II. Verdadero o falso (20 puntos). 6. La Ficha Técnica del Puesto contiene información general del servicio contratado.",
      true
    ),
    tf(
      "7. El apartado de Documentos Relacionados enumera manuales, procedimientos y políticas vinculados al servicio.",
      true
    ),
    tf(
      "8. El apartado de Contactos Importantes contiene únicamente los nombres de los oficiales asignados.",
      false
    ),
    tf(
      "9. Las Funciones del Puesto según Especificaciones Técnicas del Cartel corresponden a un apartado del manual.",
      true
    ),
    tf("10. El Manual del Puesto está conformado por cinco apartados principales.", true),

    choice(
      "Parte III. Documentos relacionados (25 puntos). 11. ¿Cuántos documentos relacionados aparecen enumerados en el Manual del Puesto?",
      5,
      -1,
      ["A. 10 documentos.", "B. 12 documentos.", "C. 14 documentos.", "D. 16 documentos."]
    ),
    choice(
      "12. ¿Cuál es el documento relacionado con el uso y manejo correcto de la bitácora?",
      4,
      0,
      ["A. M-OP-04.", "B. M-OP-05.", "C. P-OP-04.", "D. M-RH-03."]
    ),
    choice(
      "13. ¿Cuál documento corresponde al Manual de Derechos Humanos?",
      4,
      1,
      ["A. PO-RH-03.", "B. M-RH-03.", "C. PO-SIG-01.", "D. M-OP-01."]
    ),
    choice(
      "14. ¿Cuál documento corresponde a los Protocolos de Emergencia?",
      4,
      2,
      ["A. P-SO-01.", "B. M-OP-05.", "C. M-OP-02.", "D. PO-SIG-03."]
    ),
    choice(
      "15. ¿Cuál documento corresponde a los Lineamientos para Oficiales de Seguridad?",
      4,
      0,
      ["A. M-OP-01.", "B. M-OP-04.", "C. PO-RH-03.", "D. P-OP-04."]
    ),
    choice(
      "16. ¿Cuál documento corresponde al Código de Ética y Conducta Empresarial?",
      4,
      1,
      ["A. PO-SIG-02.", "B. PO-RH-03.", "C. M-RH-03.", "D. P-SO-01."]
    ),

    choice(
      "Parte IV. Identificación de documentos (15 puntos). 17. El documento P-SO-01 corresponde a:",
      5,
      1,
      [
        "A. Supervisión de Puestos.",
        "B. Reporte de Accidente Laboral.",
        "C. Uso de la Fuerza.",
        "D. Política de Denuncia.",
      ]
    ),
    choice(
      "18. El documento PO-SIG-01 corresponde a:",
      5,
      0,
      [
        "A. Política Integrada de Gestión.",
        "B. Declaración de Conformidad.",
        "C. Objetivos del Sistema Integrado de Gestión.",
        "D. Política de Denuncia.",
      ]
    ),
    choice(
      "19. El documento PO-SIG-03 corresponde a:",
      5,
      2,
      [
        "A. Código de Ética y Conducta Empresarial.",
        "B. Política Integrada de Gestión.",
        "C. Política de Denuncia.",
        "D. Manual de Derechos Humanos.",
      ]
    ),

    open(
      "Parte V. Conocimiento general (20 puntos). 20. Escriba los nombres de las cinco partes principales del Manual del Puesto.",
      7
    ),
    open(
      "21. Mencione cinco documentos relacionados que aparecen en el Manual del Puesto.",
      7
    ),
    open("22. ¿Por qué considera importante conocer y estudiar el Manual del Puesto?", 6),
  ] satisfies QuizSeedQuestion[],
};
