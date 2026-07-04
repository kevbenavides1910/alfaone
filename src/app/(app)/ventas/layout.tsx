import { VentasShell } from "@/components/ventas/VentasShell";

export default function VentasLayout({ children }: { children: React.ReactNode }) {
  return <VentasShell>{children}</VentasShell>;
}
