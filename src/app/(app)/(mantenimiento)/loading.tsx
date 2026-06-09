import { Topbar } from "@/components/layout/Topbar";

export default function MantenimientoLoading() {
  return (
    <>
      <div className="h-10 border-b bg-slate-800 animate-pulse" />
      <Topbar title="Mantenimiento" />
      <div className="p-12 text-center text-slate-400">Cargando…</div>
    </>
  );
}
