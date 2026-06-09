import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import { PermissionGuard } from "@/components/permissions/PermissionGuard";
import { SidebarPane } from "@/components/layout/SidebarPane";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar — hidden on mobile, visible from md breakpoint */}
      <div className="hidden md:block shrink-0">
        <SidebarPane />
      </div>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <PermissionGuard>{children}</PermissionGuard>
      </div>
    </div>
  );
}
