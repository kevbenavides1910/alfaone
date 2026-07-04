-- Duración en minutos para calcular hora de fin de cada ronda (inicio + duración).
ALTER TABLE "patrol_routes" ADD COLUMN "scheduleDurationMinutes" INTEGER;
