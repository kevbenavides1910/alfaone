-- Completa cláusulas faltantes de INTE/ISO 9001:2015 e INTE/ISO 18788:2018
-- y corrige títulos de 18788 que estaban copiados de la numeración 9001.

UPDATE "sig_requirements" AS r SET
  title = v.title, description = v.descripcion, observations = v.observaciones, "isApplicable" = v.aplicable, "lastReviewedAt" = NOW()
FROM (VALUES
  ('ISO_18788','8.5','Operaciones en apoyo de la aplicación de la ley','Definir el apoyo a la aplicación de la ley y sus límites. La detención (8.5.2) está fuera del alcance.','En INTE/ISO 18788 el 8.5 no es la prestación del servicio (eso es ISO 9001 8.5). M-SIG-01 lo trata como 8.5.a. 8.5.2 detención excluida. La vigilancia diaria sigue en ISO 9001 8.5 (P-OP-01, P-OP-04, P-OP-05).',true),
  ('ISO_18788','8.7','Salud y seguridad ocupacional','Mantener condiciones de trabajo seguras y saludables para el personal de operaciones de seguridad.','En INTE/ISO 18788 el 8.7 es salud ocupacional, no el servicio no conforme. M-SIG-01 §8.7.a. Biblioteca: PO-SO-01 y M-SO-01. El servicio no conforme de calidad es ISO 9001 8.7 (P-SIG-10).',true),
  ('ISO_18788','10.2','Mejora continua','Mejorar de forma continua el sistema de operaciones de seguridad, incluida la gestión del cambio.','En INTE/ISO 18788 la no conformidad es el 10.1 y la mejora continua es el 10.2. Evidencia: P-CORP-02, P-SIG-04 y la revisión por la dirección.',true),
  ('ISO_18788','8.4','Aprehensión y revisión','No aplica: el alcance del SIG excluye aprehensión y revisión.','Exclusión declarada en M-SIG-01 §4.3 (8.4, 8.4.1 y 8.4.2). El control de proveedores es ISO 9001 8.4.',false)
) AS v(norma, codigo, title, descripcion, observaciones, aplicable)
JOIN "sig_standards" s ON s.code = v.norma
WHERE r."standardId" = s.id AND r.code = v.codigo;

INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_10_2_1', s.id, '10.2.1', 'Tratamiento de la no conformidad y acción correctiva', 'Demostrar «Tratamiento de la no conformidad y acción correctiva» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '10.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '10.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_10_2_2', s.id, '10.2.2', 'Evidencia de no conformidades y acciones', 'Demostrar «Evidencia de no conformidades y acciones» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '10.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '10.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_4_4_1', s.id, '4.4.1', 'Establecimiento del SGC y sus procesos', 'Demostrar «Establecimiento del SGC y sus procesos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '4.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '4.4.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_4_4_2', s.id, '4.4.2', 'Información documentada de los procesos', 'Demostrar «Información documentada de los procesos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '4.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '4.4.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_5_1_1', s.id, '5.1.1', 'Generalidades del liderazgo', 'Demostrar «Generalidades del liderazgo» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '5.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '5.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_5_1_2', s.id, '5.1.2', 'Enfoque al cliente', 'Demostrar «Enfoque al cliente» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '5.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '5.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_5_2_1', s.id, '5.2.1', 'Establecimiento de la política de la calidad', 'Demostrar «Establecimiento de la política de la calidad» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '5.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '5.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_5_2_2', s.id, '5.2.2', 'Comunicación de la política de la calidad', 'Demostrar «Comunicación de la política de la calidad» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '5.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '5.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_6_1_1', s.id, '6.1.1', 'Generalidades de riesgos y oportunidades', 'Demostrar «Generalidades de riesgos y oportunidades» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '6.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '6.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_6_1_2', s.id, '6.1.2', 'Planificación de las acciones', 'Demostrar «Planificación de las acciones» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '6.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '6.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_6_2_1', s.id, '6.2.1', 'Objetivos de la calidad', 'Demostrar «Objetivos de la calidad» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '6.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '6.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_6_2_2', s.id, '6.2.2', 'Planificación para lograr los objetivos', 'Demostrar «Planificación para lograr los objetivos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '6.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '6.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_1_1', s.id, '7.1.1', 'Generalidades de recursos', 'Demostrar «Generalidades de recursos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_1_2', s.id, '7.1.2', 'Personas', 'Demostrar «Personas» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_1_3', s.id, '7.1.3', 'Infraestructura', 'Demostrar «Infraestructura» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_1_4', s.id, '7.1.4', 'Ambiente para la operación de los procesos', 'Demostrar «Ambiente para la operación de los procesos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_1_5', s.id, '7.1.5', 'Recursos de seguimiento y medición', 'Demostrar «Recursos de seguimiento y medición» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.5'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_1_6', s.id, '7.1.6', 'Conocimientos de la organización', 'Demostrar «Conocimientos de la organización» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.6'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_5_1', s.id, '7.5.1', 'Generalidades de la información documentada', 'Demostrar «Generalidades de la información documentada» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.5.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_5_2', s.id, '7.5.2', 'Creación y actualización', 'Demostrar «Creación y actualización» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.5.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_5_3', s.id, '7.5.3', 'Control de la información documentada', 'Demostrar «Control de la información documentada» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.5.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_2_1', s.id, '8.2.1', 'Comunicación con el cliente', 'Demostrar «Comunicación con el cliente» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_2_2', s.id, '8.2.2', 'Determinación de los requisitos del servicio', 'Demostrar «Determinación de los requisitos del servicio» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_2_3', s.id, '8.2.3', 'Revisión de los requisitos del servicio', 'Demostrar «Revisión de los requisitos del servicio» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.2.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_2_4', s.id, '8.2.4', 'Cambios en los requisitos del servicio', 'Demostrar «Cambios en los requisitos del servicio» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.2.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_3_1', s.id, '8.3.1', 'Generalidades del diseño y desarrollo', 'No aplica al alcance declarado en M-SIG-01: Generalidades del diseño y desarrollo.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_3_2', s.id, '8.3.2', 'Planificación del diseño y desarrollo', 'No aplica al alcance declarado en M-SIG-01: Planificación del diseño y desarrollo.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_3_3', s.id, '8.3.3', 'Entradas para el diseño y desarrollo', 'No aplica al alcance declarado en M-SIG-01: Entradas para el diseño y desarrollo.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_3_4', s.id, '8.3.4', 'Controles del diseño y desarrollo', 'No aplica al alcance declarado en M-SIG-01: Controles del diseño y desarrollo.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_3_5', s.id, '8.3.5', 'Salidas del diseño y desarrollo', 'No aplica al alcance declarado en M-SIG-01: Salidas del diseño y desarrollo.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.5'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_3_6', s.id, '8.3.6', 'Cambios del diseño y desarrollo', 'No aplica al alcance declarado en M-SIG-01: Cambios del diseño y desarrollo.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.6'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_4_1', s.id, '8.4.1', 'Generalidades del control de proveedores externos', 'Demostrar «Generalidades del control de proveedores externos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.4.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_4_2', s.id, '8.4.2', 'Tipo y alcance del control', 'Demostrar «Tipo y alcance del control» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.4.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_4_3', s.id, '8.4.3', 'Información para los proveedores externos', 'Demostrar «Información para los proveedores externos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.4.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_5_1', s.id, '8.5.1', 'Control de la provisión del servicio', 'Demostrar «Control de la provisión del servicio» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.5.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_5_2', s.id, '8.5.2', 'Identificación y trazabilidad', 'Demostrar «Identificación y trazabilidad» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.5.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_5_3', s.id, '8.5.3', 'Propiedad del cliente o de proveedores externos', 'Demostrar «Propiedad del cliente o de proveedores externos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.5.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_5_4', s.id, '8.5.4', 'Preservación', 'Demostrar «Preservación» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.5.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_5_5', s.id, '8.5.5', 'Actividades posteriores a la entrega', 'Demostrar «Actividades posteriores a la entrega» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.5.5'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_5_6', s.id, '8.5.6', 'Control de los cambios', 'Demostrar «Control de los cambios» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.5.6'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_7_1', s.id, '8.7.1', 'Control de las salidas no conformes', 'Demostrar «Control de las salidas no conformes» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.7'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.7.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_8_7_2', s.id, '8.7.2', 'Evidencia de salidas no conformes', 'Demostrar «Evidencia de salidas no conformes» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.7'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.7.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_9_1_1', s.id, '9.1.1', 'Generalidades de seguimiento y medición', 'Demostrar «Generalidades de seguimiento y medición» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_9_1_2', s.id, '9.1.2', 'Satisfacción del cliente', 'Demostrar «Satisfacción del cliente» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_9_1_3', s.id, '9.1.3', 'Análisis y evaluación', 'Demostrar «Análisis y evaluación» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.1.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_9_2_1', s.id, '9.2.1', 'Programa de auditoría interna', 'Demostrar «Programa de auditoría interna» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_9_2_2', s.id, '9.2.2', 'Realización de la auditoría interna', 'Demostrar «Realización de la auditoría interna» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_9_3_1', s.id, '9.3.1', 'Generalidades de la revisión por la dirección', 'Demostrar «Generalidades de la revisión por la dirección» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.3.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_9_3_2', s.id, '9.3.2', 'Entradas de la revisión por la dirección', 'Demostrar «Entradas de la revisión por la dirección» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.3.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_9_3_3', s.id, '9.3.3', 'Salidas de la revisión por la dirección', 'Demostrar «Salidas de la revisión por la dirección» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.3.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_9001_7_1_5_1', s.id, '7.1.5.1', 'Generalidades de seguimiento y medición', 'Demostrar «Generalidades de seguimiento y medición» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_9001'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.5.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_10_1', s.id, '10.1', 'No conformidades y acciones correctivas', 'Demostrar «No conformidades y acciones correctivas» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '10'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '10.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_2', s.id, '8.2', 'Normas y códigos de conducta ética', 'Demostrar «Normas y códigos de conducta ética» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_6', s.id, '8.6', 'Recursos, funciones, responsabilidad y autoridad', 'Demostrar «Recursos, funciones, responsabilidad y autoridad» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.6'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_10_2_1', s.id, '10.2.1', 'Generalidades de la mejora continua', 'Demostrar «Generalidades de la mejora continua» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '10.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '10.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_10_2_2', s.id, '10.2.2', 'Gestión del cambio', 'Demostrar «Gestión del cambio» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '10.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '10.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_10_2_3', s.id, '10.2.3', 'Oportunidades de mejora', 'Demostrar «Oportunidades de mejora» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '10.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '10.2.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_4_1_1', s.id, '4.1.1', 'Generalidades del contexto', 'Demostrar «Generalidades del contexto» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '4.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '4.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_4_1_2', s.id, '4.1.2', 'Contexto interno', 'Demostrar «Contexto interno» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '4.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '4.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_4_1_3', s.id, '4.1.3', 'Contexto externo', 'Demostrar «Contexto externo» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '4.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '4.1.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_4_1_4', s.id, '4.1.4', 'Mapeo de la cadena de suministro y subcontratistas', 'Demostrar «Mapeo de la cadena de suministro y subcontratistas» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '4.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '4.1.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_4_1_5', s.id, '4.1.5', 'Criterios de riesgo', 'Demostrar «Criterios de riesgo» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '4.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '4.1.5'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_5_1_1', s.id, '5.1.1', 'Generalidades del liderazgo', 'Demostrar «Generalidades del liderazgo» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '5.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '5.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_5_1_2', s.id, '5.1.2', 'Declaración de conformidad', 'Demostrar «Declaración de conformidad» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '5.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '5.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_6_1_1', s.id, '6.1.1', 'Generalidades de riesgos y oportunidades', 'Demostrar «Generalidades de riesgos y oportunidades» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '6.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '6.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_6_1_3', s.id, '6.1.3', 'Comunicación y consulta de riesgos', 'Demostrar «Comunicación y consulta de riesgos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '6.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '6.1.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_6_2_1', s.id, '6.2.1', 'Generalidades de objetivos de seguridad', 'Demostrar «Generalidades de objetivos de seguridad» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '6.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '6.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_6_2_2', s.id, '6.2.2', 'Logro de operaciones y objetivos de tratamiento del riesgo', 'Demostrar «Logro de operaciones y objetivos de tratamiento del riesgo» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '6.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '6.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_1_1', s.id, '7.1.1', 'Generalidades de recursos', 'Demostrar «Generalidades de recursos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_1_2', s.id, '7.1.2', 'Requisitos estructurales', 'Demostrar «Requisitos estructurales» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_2_1', s.id, '7.2.1', 'Generalidades de la competencia', 'Demostrar «Generalidades de la competencia» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_2_2', s.id, '7.2.2', 'Identificación de competencias', 'Demostrar «Identificación de competencias» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_2_3', s.id, '7.2.3', 'Capacitación y evaluación de la competencia', 'Demostrar «Capacitación y evaluación de la competencia» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.2.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_2_4', s.id, '7.2.4', 'Documentación de la competencia', 'Demostrar «Documentación de la competencia» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.2.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_4_1', s.id, '7.4.1', 'Generalidades de la comunicación', 'Demostrar «Generalidades de la comunicación» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.4.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_4_2', s.id, '7.4.2', 'Comunicaciones operacionales', 'Demostrar «Comunicaciones operacionales» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.4.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_4_3', s.id, '7.4.3', 'Comunicación de riesgos', 'Demostrar «Comunicación de riesgos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.4.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_4_4', s.id, '7.4.4', 'Comunicación de denuncia y quejas', 'Demostrar «Comunicación de denuncia y quejas» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.4.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_4_5', s.id, '7.4.5', 'Comunicación de la política de denuncia', 'Demostrar «Comunicación de la política de denuncia» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.4.5'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_5_1', s.id, '7.5.1', 'Generalidades de la información documentada', 'Demostrar «Generalidades de la información documentada» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.5.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_5_2', s.id, '7.5.2', 'Creación y actualización', 'Demostrar «Creación y actualización» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.5.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_5_3', s.id, '7.5.3', 'Control de la información documentada', 'Demostrar «Control de la información documentada» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.5.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_1_1', s.id, '8.1.1', 'Generalidades de la planificación operacional', 'Demostrar «Generalidades de la planificación operacional» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_1_2', s.id, '8.1.2', 'Desempeño de funciones de seguridad', 'Demostrar «Desempeño de funciones de seguridad» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_1_4', s.id, '8.1.4', 'Prevención de acontecimientos indeseables', 'Demostrar «Prevención de acontecimientos indeseables» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.1.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_3_1', s.id, '8.3.1', 'Generalidades del uso de la fuerza', 'Demostrar «Generalidades del uso de la fuerza» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_3_2', s.id, '8.3.2', 'Autorización de armas', 'Demostrar «Autorización de armas» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_3_3', s.id, '8.3.3', 'Uso continuo de la fuerza', 'Demostrar «Uso continuo de la fuerza» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_3_4', s.id, '8.3.4', 'Fuerza menos letal', 'Demostrar «Fuerza menos letal» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_3_5', s.id, '8.3.5', 'Fuerza letal', 'Demostrar «Fuerza letal» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.5'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_3_6', s.id, '8.3.6', 'Uso de la fuerza en apoyo del cumplimiento de la ley', 'Demostrar «Uso de la fuerza en apoyo del cumplimiento de la ley» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.6'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_3_7', s.id, '8.3.7', 'Formación en el uso de la fuerza', 'Demostrar «Formación en el uso de la fuerza» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.3.7'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_4_1', s.id, '8.4.1', 'Aprehensión', 'No aplica al alcance declarado en M-SIG-01: Aprehensión.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.4.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_4_2', s.id, '8.4.2', 'Revisión', 'No aplica al alcance declarado en M-SIG-01: Revisión.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.4'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.4.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_5_1', s.id, '8.5.1', 'Apoyo a la aplicación de la ley', 'Demostrar «Apoyo a la aplicación de la ley» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.5'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.5.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_6_1', s.id, '8.6.1', 'Generalidades de recursos operativos', 'Demostrar «Generalidades de recursos operativos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.6'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.6.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_6_2', s.id, '8.6.2', 'Personal', 'Demostrar «Personal» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.6'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.6.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_6_3', s.id, '8.6.3', 'Compra y manejo de armas, municiones y materiales peligrosos', 'Demostrar «Compra y manejo de armas, municiones y materiales peligrosos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.6'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.6.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_6_4', s.id, '8.6.4', 'Uniformes y marcas', 'Demostrar «Uniformes y marcas» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.6'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.6.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_8_1', s.id, '8.8.1', 'Generalidades de la gestión de incidentes', 'Demostrar «Generalidades de la gestión de incidentes» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.8'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.8.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_8_2', s.id, '8.8.2', 'Seguimiento, informe e investigación de incidentes', 'Demostrar «Seguimiento, informe e investigación de incidentes» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.8'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.8.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_8_3', s.id, '8.8.3', 'Quejas y reclamos internos y externos', 'Demostrar «Quejas y reclamos internos y externos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.8'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.8.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_8_4', s.id, '8.8.4', 'Política del denunciante', 'Demostrar «Política del denunciante» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.8'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.8.4'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_9_1_1', s.id, '9.1.1', 'Generalidades de seguimiento y medición', 'Demostrar «Generalidades de seguimiento y medición» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.1.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_9_1_2', s.id, '9.1.2', 'Evaluación del cumplimiento', 'Demostrar «Evaluación del cumplimiento» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.1'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.1.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_9_2_1', s.id, '9.2.1', 'Programa de auditoría interna', 'Demostrar «Programa de auditoría interna» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_9_2_2', s.id, '9.2.2', 'Realización de la auditoría interna', 'Demostrar «Realización de la auditoría interna» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_9_3_1', s.id, '9.3.1', 'Generalidades de la revisión por la dirección', 'Demostrar «Generalidades de la revisión por la dirección» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.3.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_9_3_2', s.id, '9.3.2', 'Entradas de la revisión por la dirección', 'Demostrar «Entradas de la revisión por la dirección» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.3.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_9_3_3', s.id, '9.3.3', 'Salidas de la revisión por la dirección', 'Demostrar «Salidas de la revisión por la dirección» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '9.3'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '9.3.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_1_2_1', s.id, '7.1.2.1', 'Generalidades de la estructura', 'Demostrar «Generalidades de la estructura» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_1_2_2', s.id, '7.1.2.2', 'Estructura organizacional', 'Demostrar «Estructura organizacional» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_1_2_3', s.id, '7.1.2.3', 'Seguros', 'Demostrar «Seguros» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.2.3'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_1_2_5', s.id, '7.1.2.5', 'Procedimientos financieros y administrativos', 'Demostrar «Procedimientos financieros y administrativos» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.1.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.1.2.5'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_5_2_1', s.id, '7.5.2.1', 'Generalidades de creación y actualización', 'Demostrar «Generalidades de creación y actualización» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.5.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.5.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_7_5_2_2', s.id, '7.5.2.2', 'Registros', 'Demostrar «Registros» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '7.5.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '7.5.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_6_2_1', s.id, '8.6.2.1', 'Generalidades del personal', 'Demostrar «Generalidades del personal» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.6.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.6.2.1'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_6_2_2', s.id, '8.6.2.2', 'Selección y verificación de antecedentes del personal', 'Demostrar «Selección y verificación de antecedentes del personal» conforme a la norma y al apartado correspondiente del M-SIG-01.', 'Agregado al contrastar la matriz con la norma y el manual. El requisito padre resume la evidencia; detalle aquí el control si la auditoría lo pide por separado.', true, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.6.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.6.2.2'
  );
INSERT INTO "sig_requirements"
  (id, "standardId", code, title, description, observations, "isApplicable", "sortOrder", "parentId", "lastReviewedAt", "createdAt", "updatedAt")
SELECT 'sigreq_18788_8_6_2_3', s.id, '8.6.2.3', 'Selección y verificación de subcontratistas', 'No aplica al alcance declarado en M-SIG-01: Selección y verificación de subcontratistas.', 'Exclusión de alcance del manual integrado. Conservar la justificación mientras la exclusión siga vigente.', false, 0,
  (SELECT p.id FROM "sig_requirements" p WHERE p."standardId" = s.id AND p.code = '8.6.2'), NOW(), NOW(), NOW()
FROM "sig_standards" s
WHERE s.code = 'ISO_18788'
  AND NOT EXISTS (
    SELECT 1 FROM "sig_requirements" e WHERE e."standardId" = s.id AND e.code = '8.6.2.3'
  );
