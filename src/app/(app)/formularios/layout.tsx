import { Topbar } from "@/components/layout/Topbar";
import { FormulariosSectionNav } from "@/components/formularios/FormulariosSectionNav";

export default function FormulariosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Topbar title="Formularios" />
      <FormulariosSectionNav />
      <div className="min-w-0">{children}</div>
    </>
  );
}
