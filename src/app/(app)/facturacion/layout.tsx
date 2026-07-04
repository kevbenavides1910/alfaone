import { FacturacionShell } from "@/components/facturacion/FacturacionShell";

export default function FacturacionLayout({ children }: { children: React.ReactNode }) {
  return <FacturacionShell>{children}</FacturacionShell>;
}
