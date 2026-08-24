import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import { PagosPageClient } from "@/components/pagos/PagosPageClient";

export default async function PagosPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return <PagosPageClient initialCompany={session.user.company ?? null} />;
}