import { EmpleadosSectionNav } from "@/components/empleados/EmpleadosSectionNav";

export default function EmpleadosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <EmpleadosSectionNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
