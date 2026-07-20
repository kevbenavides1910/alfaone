import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import { PermissionGuard } from "@/components/permissions/PermissionGuard";
import { SidebarPane } from "@/components/layout/SidebarPane";
import { EnableTableColumnResize } from "@/components/ui/enable-table-column-resize";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user.mustChangePassword) redirect("/change-password");

  return (
    <div className="flex min-h-screen bg-background">
      <div className="hidden md:block shrink-0 sticky top-0 h-screen">
        <SidebarPane />
      </div>

      <div className="flex-1 flex flex-col min-w-0 overflow-auto">
        <PermissionGuard>
          <EnableTableColumnResize />
          {children}
        </PermissionGuard>
      </div>
    </div>
  );
}
