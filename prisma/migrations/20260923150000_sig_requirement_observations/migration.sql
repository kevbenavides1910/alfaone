-- Matriz requisitos: observaciones editables + última revisión
ALTER TABLE "sig_requirements"
  ADD COLUMN IF NOT EXISTS "observations" TEXT,
  ADD COLUMN IF NOT EXISTS "lastReviewedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "sig_requirements_lastReviewedAt_idx"
  ON "sig_requirements"("lastReviewedAt");

-- Textos esperados (paráfrasis de cumplimiento) para ISO 9001:2015
UPDATE "sig_requirements" SET "description" = CASE "code"
  WHEN '4' THEN 'La organización debe determinar las cuestiones externas e internas pertinentes al propósito y dirección estratégica, y que afectan la capacidad de lograr los resultados previstos del SGC.'
  WHEN '4.1' THEN 'Comprender el contexto: identificar y revisar periódicamente factores internos/externos relevantes para el SGC.'
  WHEN '4.2' THEN 'Determinar las partes interesadas pertinentes, sus requisitos relevantes y monitorearlos.'
  WHEN '4.3' THEN 'Determinar los límites y aplicabilidad del SGC (alcance), documentarlo y mantenerlo disponible.'
  WHEN '4.4' THEN 'Establecer, implementar, mantener y mejorar continuamente el SGC, incluyendo los procesos necesarios y sus interacciones.'
  WHEN '5' THEN 'La alta dirección debe demostrar liderazgo y compromiso respecto al SGC.'
  WHEN '5.1' THEN 'Liderazgo y compromiso: rendición de cuentas, política, integración del SGC en los procesos de negocio y apoyo a roles.'
  WHEN '5.1.1' THEN 'La alta dirección rinde cuentas del SGC, asegura política/objetivos alineados y recursos, comunica importancia y promueve mejora.'
  WHEN '5.1.2' THEN 'Enfoque al cliente: requisitos del cliente, riesgos/oportunidades que afectan conformidad, y aumento de la satisfacción.'
  WHEN '5.2' THEN 'Establecer, implementar y mantener una política de la calidad apropiada y comunicarla.'
  WHEN '5.2.1' THEN 'Política de la calidad: apropiada al propósito, marco para objetivos, compromiso de cumplir requisitos y de mejora continua.'
  WHEN '5.2.2' THEN 'La política está disponible, se comunica, se entiende y se aplica; está disponible para partes interesadas pertinentes.'
  WHEN '5.3' THEN 'Asignar y comunicar responsabilidades y autoridades para roles relevantes del SGC.'
  WHEN '6' THEN 'Planificar el SGC considerando riesgos, oportunidades, objetivos y cambios.'
  WHEN '6.1' THEN 'Acciones para abordar riesgos y oportunidades que aseguren el SGC logre resultados previstos.'
  WHEN '6.2' THEN 'Establecer objetivos de la calidad medibles, planificar cómo lograrlos y qué recursos/responsables/plazos.'
  WHEN '6.3' THEN 'Cuando la organización determine la necesidad de cambios en el SGC, estos se llevan a cabo de manera planificada.'
  WHEN '7' THEN 'Determinar y proporcionar los recursos necesarios para el establecimiento, implementación, mantenimiento y mejora continua del SGC.'
  WHEN '7.1' THEN 'Recursos: personas, infraestructura, ambiente, seguimiento/medición y conocimiento organizacional.'
  WHEN '7.1.1' THEN 'Determinar y proporcionar los recursos necesarios considerando capacidades internas y proveedores externos.'
  WHEN '7.1.2' THEN 'Determinar y proporcionar las personas necesarias para la operación eficaz del SGC y de sus procesos.'
  WHEN '7.1.3' THEN 'Determinar, proporcionar y mantener la infraestructura necesaria para la operación de los procesos.'
  WHEN '7.1.4' THEN 'Determinar, proporcionar y mantener el ambiente necesario para la operación de los procesos.'
  WHEN '7.1.5' THEN 'Recursos de seguimiento y medición adecuados para verificar la conformidad de productos y servicios.'
  WHEN '7.1.6' THEN 'Determinar los conocimientos necesarios para la operación de los procesos y lograr la conformidad.'
  WHEN '7.2' THEN 'Determinar la competencia necesaria, asegurar que las personas sean competentes y tomar acciones para adquirir competencia.'
  WHEN '7.3' THEN 'Asegurar que las personas que realizan el trabajo tomen conciencia de la política, objetivos, su contribución y las implicaciones de no cumplir.'
  WHEN '7.4' THEN 'Determinar las comunicaciones internas y externas pertinentes al SGC.'
  WHEN '7.5' THEN 'El SGC debe incluir la información documentada requerida por la norma y la determinada por la organización como necesaria.'
  WHEN '7.5.1' THEN 'Información documentada general: requerida por ISO 9001 y la necesaria para la eficacia del SGC.'
  WHEN '7.5.2' THEN 'Crear y actualizar: identificación, formato, revisión y aprobación de la idoneidad.'
  WHEN '7.5.3' THEN 'Control de la información documentada: distribución, acceso, almacenamiento, control de cambios y retención/disposición.'
  WHEN '8' THEN 'Planificar, implementar y controlar los procesos necesarios para proporcionar productos y servicios.'
  WHEN '8.1' THEN 'Planificación y control operacional: requisitos, criterios, recursos, controles y información documentada.'
  WHEN '8.2' THEN 'Requisitos para productos y servicios: comunicación con el cliente, determinación, revisión y cambios.'
  WHEN '8.3' THEN 'Diseño y desarrollo de productos y servicios (si aplica al alcance).'
  WHEN '8.4' THEN 'Control de los procesos, productos y servicios suministrados externamente.'
  WHEN '8.5' THEN 'Producción y provisión del servicio bajo condiciones controladas.'
  WHEN '8.6' THEN 'Liberar productos y servicios solo después de verificaciones planificadas.'
  WHEN '8.7' THEN 'Controlar las salidas no conformes e informar/tomar acciones apropiadas.'
  WHEN '9' THEN 'Evaluar el desempeño del SGC mediante seguimiento, medición, análisis, auditoría y revisión.'
  WHEN '9.1' THEN 'Seguimiento, medición, análisis y evaluación, incluida la satisfacción del cliente.'
  WHEN '9.2' THEN 'Auditorías internas a intervalos planificados para verificar conformidad y eficacia del SGC.'
  WHEN '9.3' THEN 'La alta dirección revisa el SGC a intervalos planificados (revisión por la dirección).'
  WHEN '10' THEN 'Determinar y seleccionar oportunidades de mejora e implementar acciones necesarias.'
  WHEN '10.1' THEN 'Mejora: mejorar productos/servicios, corregir/prevenir efectos no deseados y mejorar el desempeño del SGC.'
  WHEN '10.2' THEN 'No conformidad y acción correctiva: reaccionar, evaluar causa, implementar acción, revisar eficacia y actualizar riesgos si procede.'
  WHEN '10.3' THEN 'Mejora continua de la idoneidad, adecuación y eficacia del SGC.'
  ELSE "description"
END
WHERE "standardId" = 'sigstd_iso9001'
  AND ("description" IS NULL OR btrim("description") = '');

-- Observaciones iniciales (borrador editable) cuando aún no hay
UPDATE "sig_requirements" SET "observations" = CASE
  WHEN "isApplicable" = false THEN 'Marcado como no aplicable. Documentar justificación del alcance y mantener evidencia de la exclusión.'
  ELSE 'Pendiente de completar: vincular procesos responsables, documentos controlados y evidencias objetivas que demuestren el cumplimiento de este requisito. Revisar en la próxima auditoría interna / revisión por la dirección.'
END
WHERE "observations" IS NULL;
