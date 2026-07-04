import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { priorityBadgeClasses, statusBadgeClasses } from "@/modules/tickets-ti/business/status-colors";

export function TicketStatusBadge({
  code,
  name,
  className,
}: {
  code: string;
  name: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(statusBadgeClasses(code), "border", className)}>
      {name}
    </Badge>
  );
}

export function TicketPriorityBadge({
  code,
  name,
  className,
}: {
  code: string;
  name: string;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(priorityBadgeClasses(code), "border", className)}>
      {name}
    </Badge>
  );
}
