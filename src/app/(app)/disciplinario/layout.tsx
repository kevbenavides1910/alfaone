import { DisciplinarioShell } from "@/components/disciplinary/DisciplinarioShell";

export default function DisciplinarioLayout({ children }: { children: React.ReactNode }) {
  return <DisciplinarioShell>{children}</DisciplinarioShell>;
}
