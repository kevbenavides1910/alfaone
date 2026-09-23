-- Capítulos (4…10) y «Generalidades» de relleno: no aplicables por separado.
-- Conserva 10.1 «Generalidades» con texto real de mejora (no es boilerplate).

UPDATE "sig_requirements"
SET
  "isApplicable" = false,
  observations = CASE
    WHEN observations IS NULL OR btrim(observations) = '' THEN
      'Apartado estructural (capítulo o generalidades): no se evalúa por separado; el cumplimiento se documenta en las cláusulas con requisitos «debe».'
    WHEN observations ILIKE '%Apartado estructural%' THEN observations
    ELSE observations || E'\nApartado estructural (capítulo o generalidades): no se evalúa por separado; el cumplimiento se documenta en las cláusulas con requisitos «debe».'
  END,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE
  code ~ '^[0-9]+$'
  OR (
    title ILIKE '%generalidad%'
    AND (
      observations ILIKE '%Agregado al contrastar%'
      OR description ILIKE 'Demostrar %Generalidades%'
    )
  );
