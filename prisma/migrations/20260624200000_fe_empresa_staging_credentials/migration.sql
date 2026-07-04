-- AlterTable: add separate staging credentials to FeEmpresa
ALTER TABLE "fe_empresas"
  ADD COLUMN IF NOT EXISTS "certificadoPathStg"        TEXT,
  ADD COLUMN IF NOT EXISTS "certificadoFileNameStg"    TEXT,
  ADD COLUMN IF NOT EXISTS "certificadoExpiresAtStg"   TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "certificadoPasswordEncStg" TEXT,
  ADD COLUMN IF NOT EXISTS "atvUsuarioStg"             TEXT,
  ADD COLUMN IF NOT EXISTS "atvPasswordEncStg"         TEXT;
