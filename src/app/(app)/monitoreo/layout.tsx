import { MonitoreoShell } from "@/components/monitoreo/MonitoreoShell";

export default function MonitoreoLayout({ children }: { children: React.ReactNode }) {
  return <MonitoreoShell>{children}</MonitoreoShell>;
}
