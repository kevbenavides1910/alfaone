import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import PendientesAsignarClient from "./PendientesAsignarClient";

export default async function PendientesAsignarPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <PendientesAsignarClient />;
}
