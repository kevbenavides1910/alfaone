import { getAppSession } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import { DocumentosLegalesPageClient } from "@/components/documentos-legales/DocumentosLegalesPageClient";

export default async function DocumentosLegalesPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");
  return <DocumentosLegalesPageClient />;
}
