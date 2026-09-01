import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import { PagosPageClient } from "@/components/pagos/PagosPageClient";

export default async function PagosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // El calendario agrupa pagos de todo el grupo (APEX/gastos/manuales).
  // No filtrar por compañía de sesión: si no, desaparecen pagos ya marcados
  // de otras compañías (p.ej. 06, AA, BENA).
  return <PagosPageClient />;
}