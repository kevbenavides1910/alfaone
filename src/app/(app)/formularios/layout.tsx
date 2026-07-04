import { FormulariosSectionNav } from "@/components/formularios/FormulariosSectionNav";

export default function FormulariosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <FormulariosSectionNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
