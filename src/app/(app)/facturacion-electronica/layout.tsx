import { FeElectronicaShell } from "@/components/facturacion-electronica/FeElectronicaShell";

export default function FacturacionElectronicaLayout({ children }: { children: React.ReactNode }) {
  return <FeElectronicaShell>{children}</FeElectronicaShell>;
}
