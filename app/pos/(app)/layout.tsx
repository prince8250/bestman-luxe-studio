import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { getPosUser } from "@/lib/auth/pos-user";

import { signOutAction } from "../login/actions";

// Every page in this group needs an active POS user, checked on the server.
// TEMPORARY top bar (spec 03): spec 04 replaces it with the full POS shell.
export default async function PosAppLayout({ children }: LayoutProps<"/pos">) {
  const user = await getPosUser();
  if (!user) redirect("/pos/login");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-pos-border bg-pos-surface px-4 py-2">
        <span className="display-type text-2xl">Bestman POS</span>
        <div className="flex items-center gap-3">
          <span className="text-sm">
            {user.displayName} · <span className="text-pos-text-muted capitalize">{user.role}</span>
          </span>
          <form action={signOutAction}>
            <PosButton type="submit" variant="secondary">
              <LogOut /> Sign out
            </PosButton>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
