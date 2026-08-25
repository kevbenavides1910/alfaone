export type FingerAttendanceStatusKey =
  | "PRESENT"
  | "ABSENT"
  | "INCOMPLETE"
  | "LATE"
  | "EARLY_LEAVE";

export const ATTENDANCE_STATUS_LABEL: Record<FingerAttendanceStatusKey, string> = {
  PRESENT: "Presente",
  ABSENT: "Ausente",
  INCOMPLETE: "Incompleto",
  LATE: "Tardía",
  EARLY_LEAVE: "Salida anticipada",
};

export const ATTENDANCE_STATUS_TONE: Record<FingerAttendanceStatusKey, string> = {
  PRESENT: "bg-emerald-100 text-emerald-800",
  ABSENT: "bg-red-100 text-red-800",
  INCOMPLETE: "bg-amber-100 text-amber-800",
  LATE: "bg-orange-100 text-orange-800",
  EARLY_LEAVE: "bg-yellow-100 text-yellow-800",
};

export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
