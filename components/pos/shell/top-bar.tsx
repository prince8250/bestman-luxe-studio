import Image from "next/image";
import Link from "next/link";
import { LogOut } from "lucide-react";

import { homePathFor, type PosUser } from "@/lib/auth/types";

import { signOutAction } from "@/app/pos/login/actions";

import { FindBox } from "./find-box";

// The signed-in name and role are always visible, so nobody forgets which
// account is signed in on the shared counter PC (ui-context.md, "Role Home Pages").
export function TopBar({ user }: { user: PosUser }) {
  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-pos-border bg-pos-surface/95 px-3 py-2 backdrop-blur-sm md:h-16 md:flex-nowrap md:px-6 md:py-0">
      <Link href={homePathFor(user.role)} className="shrink-0 md:hidden" aria-label="Bestman POS home">
        <Image src="/brand/logo-receipt.png" alt="" width={36} height={36} className="h-9 w-9" />
      </Link>
      {/* On a phone, Find gets its own full-width row under the name. */}
      <div className="order-last w-full min-w-0 md:order-none md:w-auto md:flex-1">
        <FindBox />
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2 md:ml-0 md:shrink-0">
        <div className="min-w-0 text-right leading-tight">
          <p className="truncate text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-pos-text-muted capitalize">{user.role}</p>
        </div>
        <form action={signOutAction}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-pos-text-muted transition-colors duration-150 hover:bg-pos-subtle hover:text-pos-text focus-visible:outline-2 focus-visible:outline-pos-accent"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </form>
      </div>
    </header>
  );
}
