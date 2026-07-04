import type { FormQuestionType } from "@prisma/client";

export type QuizSeedOption = {
  label: string;
  isCorrect: boolean;
};

export type QuizSeedQuestion = {
  text: string;
  type: FormQuestionType;
  points?: number;
  isCritical?: boolean;
  correctTrueFalse?: boolean;
  options?: QuizSeedOption[];
};

export const QUIZ_SIG_INDUCCION = {
  code: "QUIZ-SIG-2026-v1",
  title: "Quiz de Inducción SIG — Personal administrativo",
  description:
    "Evaluación de conciencia del Sistema Integrado de Gestión (ISO 9001 + ISO 18788) para personal administrativo y de oficina. Aprobación: 80 %.",
  passScorePercent: 80,
  questions: [
    {
      text: "¿Cuál es el propósito principal de la Política de Calidad de la empresa?",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Establecer sanciones para los empleados", isCorrect: false },
        {
          label: "Definir los compromisos de la organización con la calidad, el cliente y la mejora continua",
          isCorrect: true,
        },
        { label: "Sustituir la ley y el reglamento interno", isCorrect: false },
        { label: "Aplicar solo al área de calidad", isCorrect: false },
      ],
    },
    {
      text: "Como personal administrativo, ¿qué aporta usted al Sistema Integrado de Gestión?",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Nada; eso es solo responsabilidad de operaciones", isCorrect: false },
        {
          label: "Cumplir los procedimientos de su puesto, mantener registros confiables y reportar desvíos",
          isCorrect: true,
        },
        { label: "Solo archivar papeles sin revisar su vigencia", isCorrect: false },
        { label: "Evitar reportar errores para no retrasar el trabajo", isCorrect: false },
      ],
    },
    {
      text: "La norma ISO 9001 exige principalmente que la organización:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Gestione la calidad de forma sistemática y orientada al cliente", isCorrect: true },
        { label: "Elimine toda documentación en papel", isCorrect: false },
        { label: "Sustituya la contabilidad por auditorías", isCorrect: false },
        { label: "Certifique solo al personal de campo", isCorrect: false },
      ],
    },
    {
      text: "Para personal administrativo, ISO 18788 implica apoyar la operación de seguridad:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Con procesos legales, trazables y respetuosos de derechos humanos", isCorrect: true },
        { label: "Sin ningún requisito documental", isCorrect: false },
        { label: "Solo mediante compras de uniformes", isCorrect: false },
        { label: "Exclusivamente con software de marcaje", isCorrect: false },
      ],
    },
    {
      text: "¿Dónde debe consultar la versión vigente de un procedimiento o formato oficial?",
      type: "SINGLE_CHOICE" as const,
      isCritical: true,
      options: [
        { label: "En copias impresas guardadas en el escritorio, aunque sean antiguas", isCorrect: false },
        {
          label: "En el módulo SIG de Alfa One o en la fuente oficial indicada por la empresa",
          isCorrect: true,
        },
        { label: "En archivos enviados por correo hace meses", isCorrect: false },
        { label: "En carpetas personales de OneDrive o WhatsApp", isCorrect: false },
      ],
    },
    {
      text: "Si encuentra un documento sin código, versión o fecha de revisión, debe:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Usarlo si “se ve reciente”", isCorrect: false },
        { label: "No usarlo como referencia oficial y consultar la versión vigente en SIG", isCorrect: true },
        { label: "Modificarlo usted mismo para actualizarlo", isCorrect: false },
        { label: "Eliminarlo sin informar a nadie", isCorrect: false },
      ],
    },
    {
      text: "Un “registro” en el SIG es:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Evidencia de que se realizó una actividad (formulario lleno, lista, bitácora, etc.)", isCorrect: true },
        { label: "Un documento decorativo sin valor", isCorrect: false },
        { label: "Solo un manual de políticas", isCorrect: false },
        { label: "Cualquier borrador sin firmar", isCorrect: false },
      ],
    },
    {
      text: "El enfoque al cliente en su trabajo administrativo significa:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Atender con calidad las necesidades internas y externas de quienes dependen de su gestión", isCorrect: true },
        { label: "Priorizar solo lo urgente aunque falle un requisito", isCorrect: false },
        { label: "Negarse a atender solicitudes de otras áreas", isCorrect: false },
        { label: "Aprobar todo sin revisar para agilizar", isCorrect: false },
      ],
    },
    {
      text: "Si un cliente interno o externo presenta una queja sobre un trámite o servicio administrativo, usted debe:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Ignorarla si no es de su departamento", isCorrect: false },
        {
          label: "Escucharla con respeto y canalizarla según el procedimiento de quejas o inconformidades",
          isCorrect: true,
        },
        { label: "Prometer soluciones no autorizadas", isCorrect: false },
        { label: "Discutir para defender a su área sin registrar nada", isCorrect: false },
      ],
    },
    {
      text: "Una no conformidad en procesos administrativos es:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Cualquier desviación respecto a lo establecido (procedimiento, política, requisito)", isCorrect: true },
        { label: "Solo un error contable grave", isCorrect: false },
        { label: "Una opinión personal desfavorable", isCorrect: false },
        { label: "Un retraso inevitable por carga de trabajo", isCorrect: false },
      ],
    },
    {
      text: "Si detecta un error en un documento, registro o proceso administrativo, debe:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Corregirlo en silencio y no decir nada", isCorrect: false },
        { label: "Reportarlo oportunamente por la vía establecida", isCorrect: true },
        { label: "Esperar a que lo note otra persona", isCorrect: false },
        { label: "Borrar el registro para evitar problemas", isCorrect: false },
      ],
    },
    {
      text: "La mejora continua en el SIG significa que la organización:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Identifica oportunidades de mejora y corrige desvíos de forma sistemática", isCorrect: true },
        { label: "Nunca cambia sus procedimientos", isCorrect: false },
        { label: "Solo mejora cuando hay una auditoría externa", isCorrect: false },
        { label: "Depiende únicamente de sugerencias informales", isCorrect: false },
      ],
    },
    {
      text: "Durante una auditoría interna o externa, su rol administrativo incluye:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Ocultar registros incompletos", isCorrect: false },
        {
          label: "Mostrar evidencias objetivas, explicar su proceso y colaborar con transparencia",
          isCorrect: true,
        },
        { label: "Inventar respuestas para no quedar mal", isCorrect: false },
        { label: "Delegar todo al supervisor sin preparación", isCorrect: false },
      ],
    },
    {
      text: "Información confidencial de la empresa o de clientes incluye, entre otras:",
      type: "SINGLE_CHOICE" as const,
      isCritical: true,
      options: [
        { label: "Datos personales, contratos, finanzas, incidentes y operación no autorizada para divulgar", isCorrect: true },
        { label: "El nombre comercial de la empresa en el sitio web", isCorrect: false },
        { label: "El horario general de oficina", isCorrect: false },
        { label: "El logo institucional", isCorrect: false },
      ],
    },
    {
      text: "Si un compañero le pide copiar bases de datos o documentos confidenciales para uso personal, usted debe:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Enviarlos si es su amigo", isCorrect: false },
        {
          label: "Negarse y reportar la solicitud si compromete la confidencialidad o seguridad",
          isCorrect: true,
        },
        { label: "Compartirlos por WhatsApp de forma “discreta”", isCorrect: false },
        { label: "Guardarlos en una USB personal “por si acaso”", isCorrect: false },
      ],
    },
    {
      text: "Respecto al código de conducta y ética, como colaborador administrativo usted debe:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Actuar con integridad, imparcialidad y respeto en todo momento", isCorrect: true },
        { label: "Aceptar regalos de proveedores para agilizar trámites", isCorrect: false },
        { label: "Usar recursos de la empresa para fines personales sin reportarlo", isCorrect: false },
        { label: "Favorecer a familiares en procesos internos", isCorrect: false },
      ],
    },
    {
      text: "Ante un incidente relevante (fraude, fuga de información, accidente en oficina), lo primero es:",
      type: "SINGLE_CHOICE" as const,
      isCritical: true,
      options: [
        { label: "Publicarlo en redes sociales", isCorrect: false },
        {
          label: "Proteger personas e información, y avisar al supervisor o canal establecido de inmediato",
          isCorrect: true,
        },
        { label: "Esperar a la reunión semanal para comentarlo", isCorrect: false },
        { label: "Investigar por su cuenta sin avisar", isCorrect: false },
      ],
    },
    {
      text: "Los archivos físicos y digitales de expedientes administrativos deben:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Mantenerse ordenados, identificados y accesibles solo a quienes corresponda", isCorrect: true },
        { label: "Quedar en cualquier carpeta compartida sin control", isCorrect: false },
        { label: "Eliminarse al terminar el mes sin criterio", isCorrect: false },
        { label: "Fotografiarse y enviarse a grupos informales", isCorrect: false },
      ],
    },
    {
      text: "Si un proveedor le solicita datos internos no necesarios para una compra o contrato, usted debe:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Entregarlos para mantener buena relación comercial", isCorrect: false },
        { label: "Verificar qué información es necesaria y compartir solo lo autorizado", isCorrect: true },
        { label: "Enviar contratos completos sin revisión", isCorrect: false },
        { label: "Dar acceso libre a sistemas internos", isCorrect: false },
      ],
    },
    {
      text: "La trazabilidad documental en administración permite:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Demostrar qué se hizo, cuándo y con qué respaldo", isCorrect: true },
        { label: "Eliminar la responsabilidad individual", isCorrect: false },
        { label: "Evitar auditorías", isCorrect: false },
        { label: "Sustituir la firma del responsable", isCorrect: false },
      ],
    },
    {
      text: "Si recibe un correo sospechoso pidiendo contraseñas o datos bancarios de la empresa, debe:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Responder con la información si el logo se ve real", isCorrect: false },
        { label: "No hacer clic, no compartir datos y reportarlo a TI o su supervisor", isCorrect: true },
        { label: "Reenviarlo a todos para alertar", isCorrect: false },
        { label: "Abrir el adjunto para verificar", isCorrect: false },
      ],
    },
    {
      text: "Una acción correctiva en el SIG busca principalmente:",
      type: "SINGLE_CHOICE" as const,
      options: [
        { label: "Eliminar la causa de un desvío para que no se repita", isCorrect: true },
        { label: "Castigar al empleado sin analizar el origen", isCorrect: false },
        { label: "Ocultar el problema ante auditores", isCorrect: false },
        { label: "Cambiar el procedimiento sin evidencia", isCorrect: false },
      ],
    },
    {
      text: "Está permitido usar versiones obsoletas de formatos oficiales si “casi no cambiaron”.",
      type: "TRUE_FALSE" as const,
      correctTrueFalse: false,
    },
    {
      text: "El código de conducta aplica tanto en la oficina como fuera de ella cuando representa a la empresa.",
      type: "TRUE_FALSE" as const,
      correctTrueFalse: true,
    },
    {
      text: "Registrar con veracidad fechas, montos y aprobaciones es parte del cumplimiento del SIG.",
      type: "TRUE_FALSE" as const,
      correctTrueFalse: true,
    },
  ] satisfies QuizSeedQuestion[],
};
