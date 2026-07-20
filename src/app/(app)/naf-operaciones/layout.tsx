import { NafOperacionesSectionNav } from "@/components/naf-operaciones/NafOperacionesSectionNav";

export default function NafOperacionesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      <NafOperacionesSectionNav />
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
