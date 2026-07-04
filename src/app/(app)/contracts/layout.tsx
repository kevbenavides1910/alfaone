import { ContractsShell } from "@/components/contracts/ContractsShell";

export default function ContractsLayout({ children }: { children: React.ReactNode }) {
  return <ContractsShell>{children}</ContractsShell>;
}
