"use client";

import { LogOut } from "lucide-react";

import { clearAllDrafts } from "@/lib/sale/draft";
import { cn } from "@/lib/utils";

import { signOutAction } from "@/app/pos/login/actions";

// Signs out after deleting any in-progress ticket kept in this browser tab, so
// the next person to sign in on this PC never sees it.
export function SignOutButton({ variant }: { variant: "icon" | "full" }) {
  return (
    <form action={signOutAction} onSubmit={() => clearAllDrafts()}>
      <button
        type="submit"
        aria-label="Sign out"
        title="Sign out"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-[10px] text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-pos-accent",
          variant === "icon"
            ? "h-11 w-11 text-pos-text-muted hover:bg-pos-subtle hover:text-pos-text"
            : "min-h-12 w-full border border-pos-border text-pos-text",
        )}
      >
        <LogOut className="h-5 w-5" />
        {variant === "full" && "Sign out"}
      </button>
    </form>
  );
}
