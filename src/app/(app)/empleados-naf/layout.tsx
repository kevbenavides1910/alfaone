import { EmpleadosNafSectionNav } from "@/components/empleados/EmpleadosNafSectionNav";

export default function EmpleadosNafLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <EmpleadosNafSectionNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
