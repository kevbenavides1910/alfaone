import { getAppSession } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import PendientesAsignarClient from "./PendientesAsignarClient";

export default async function PendientesAsignarPage() {
  const session = await getAppSession();
  if (!session) redirect("/login");
  return <PendientesAsignarClient />;
}
