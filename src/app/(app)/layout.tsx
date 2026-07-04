import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import { PermissionGuard } from "@/components/permissions/PermissionGuard";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <main className="min-h-screen bg-background overflow-auto">
      <PermissionGuard>{children}</PermissionGuard>
    </main>
  );
}
