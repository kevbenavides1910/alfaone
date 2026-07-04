import { TicketsTiShell } from "@/components/tickets-ti/TicketsTiShell";

export default function TicketsTiLayout({ children }: { children: React.ReactNode }) {
  return <TicketsTiShell>{children}</TicketsTiShell>;
}
