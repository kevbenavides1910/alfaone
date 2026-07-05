-- Permite agregar/eliminar esquemas de mano de obra más allá de MO1–MO5 fijos.
ALTER TABLE "ventas_presupuesto_lineas" ALTER COLUMN "jornadaCodigo" TYPE TEXT USING "jornadaCodigo"::text;
ALTER TABLE "ventas_jornada_tipos" ALTER COLUMN "codigo" TYPE TEXT USING "codigo"::text;
DROP TYPE "VentasJornadaCodigo";
