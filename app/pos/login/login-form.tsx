"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signInAction, type SignInState } from "./actions";

const initialState: SignInState = { error: null, email: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={state.email}
          className="h-11 rounded-[10px] bg-pos-surface text-base"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11 rounded-[10px] bg-pos-surface text-base"
        />
      </div>

      <div aria-live="polite" className="min-h-0">
        {state.error && (
          <p role="alert" className="rounded-[10px] bg-pos-down-soft px-3 py-2.5 text-sm text-pos-down">
            {state.error}
          </p>
        )}
      </div>

      <PosButton type="submit" size="lg" fullWidth disabled={pending}>
        <LogIn />
        {pending ? "Signing in…" : "Sign in"}
      </PosButton>
    </form>
  );
}
