import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";

type Props = {
  closedOnTime: boolean;
  closeDaysLate: number;
  compact?: boolean;
};

export function FacturaTimelinessBadge({ closedOnTime, closeDaysLate, compact }: Props) {
  if (closedOnTime) {
    return (
      <Badge
        variant="outline"
        className="gap-1 border-green-200 bg-green-50 text-green-800 font-normal"
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        {compact ? "En tiempo" : "Cerrada en tiempo"}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="gap-1 border-amber-200 bg-amber-50 text-amber-900 font-normal"
    >
      <Clock className="h-3.5 w-3.5" />
      {compact
        ? `${closeDaysLate}d tarde`
        : `Fuera de plazo (${closeDaysLate} día${closeDaysLate !== 1 ? "s" : ""})`}
    </Badge>
  );
}
