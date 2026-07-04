-- Hora de convocatoria y registro del último envío por correo
ALTER TABLE "disciplinary_treatments"
  ADD COLUMN IF NOT EXISTS "horaConvocatoria" TEXT,
  ADD COLUMN IF NOT EXISTS "convocatoriaEnviadaAt" TIMESTAMP(3);
