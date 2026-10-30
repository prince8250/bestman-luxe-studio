import type { Metadata } from "next";
import Image from "next/image";
import { redirect } from "next/navigation";

import { getPosUser } from "@/lib/auth/pos-user";
import { homePathFor } from "@/lib/auth/types";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

// The only POS page reachable without a session. There is no sign-up and no
// link to it from the website: accounts are created by the developer (owner)
// and by the owner in POS Settings (counter accounts).
export default async function PosLoginPage() {
  const user = await getPosUser();
  if (user) redirect(homePathFor(user.role));

  return (
    <main className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-[16px] border border-pos-border bg-pos-surface p-6 md:p-8">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image
            src="/brand/logo-receipt.png"
            alt="Bestman Luxe Studio"
            width={96}
            height={96}
            priority
            className="h-24 w-24"
          />
          <h1 className="display-type mt-3 text-4xl">Bestman POS</h1>
          <p className="mt-1 text-sm text-pos-text-muted">Sign in to the counter system.</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
