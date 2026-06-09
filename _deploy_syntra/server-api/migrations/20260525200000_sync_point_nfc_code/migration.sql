-- Unifica tag NFC con el código del punto (campo único en web).
UPDATE patrol_route_points
SET "nfcTagCode" = UPPER(TRIM(code))
WHERE "nfcTagCode" IS DISTINCT FROM UPPER(TRIM(code));
