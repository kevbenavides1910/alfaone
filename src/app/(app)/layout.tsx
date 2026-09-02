import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/core/auth/auth-options";
import { redirect } from "next/navigation";
import { PermissionGuard } from "@/components/permissions/PermissionGuard";
import { SidebarPane } from "@/components/layout/SidebarPane";
import { EnableTableColumnResize } from "@/components/ui/enable-table-column-resize";
import { SyntraAiChatWidget } from "@/components/syntra-ai/SyntraAiChatWidget";

/** Shell autenticado: no SSG. Reduce trabajo estático en next build. */
export const dynamic = "force-dynamic";

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
          <SyntraAiChatWidget />
        </PermissionGuard>
      </div>
    </div>
  );
}
