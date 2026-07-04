-- Unificar sidebar al carbón Alfa (#121212), igual que subnav de módulos.
UPDATE "app_branding"
SET "sidebarHex" = '#121212'
WHERE LOWER(TRIM("sidebarHex")) IN (
  '#0a0a0a',
  '#0f172a',
  '#1e293b',
  '#1a1f2e',
  '#111827',
  '#172554',
  '#0c1222'
);
