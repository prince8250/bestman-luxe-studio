import { cookies } from "next/headers";

import { BottomBar } from "@/components/pos/shell/bottom-bar";
import { Sidebar } from "@/components/pos/shell/sidebar";
import { StatusCard } from "@/components/pos/shell/status-card";
import { TopBar } from "@/components/pos/shell/top-bar";
import { Toaster } from "@/components/ui/sonner";
import { requirePosUser } from "@/lib/auth/require-pos-user";

// Every page in this group needs an active POS user, checked here on the
// server (anyone else goes to /pos/login and receives no POS data). Each page
// then checks its own permission (pageAccess / requirePermission).
export default async function PosAppLayout({ children }: LayoutProps<"/pos">) {
  const user = await requirePosUser();
  const sidebarCollapsed = (await cookies()).get("pos_sidebar")?.value === "collapsed";

  return (
    <div className="flex min-h-dvh flex-1">
      <Sidebar role={user.role} initialCollapsed={sidebarCollapsed} statusCard={<StatusCard user={user} />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        {/* Room for the phone bottom bar. */}
        <div className="flex flex-1 flex-col pb-20 md:pb-0">{children}</div>
      </div>
      <BottomBar role={user.role} />
      {/* Saved and error messages. Light theme, whatever the PC's setting. */}
      <Toaster theme="light" position="top-center" richColors closeButton />
    </div>
  );
}
