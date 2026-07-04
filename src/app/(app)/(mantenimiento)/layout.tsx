import { Suspense } from "react";
import { AdminSectionNav } from "@/components/admin/AdminSectionNav";

export default function MantenimientoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex flex-col">
      <Suspense
        fallback={
          <div className="h-10 border-b border-slate-300 bg-slate-800 animate-pulse" aria-hidden />
        }
      >
        <AdminSectionNav />
      </Suspense>
      {children}
    </div>
  );
}
