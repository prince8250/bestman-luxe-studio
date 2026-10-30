"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { signInAction, type SignInState } from "./actions";

const initialState: SignInState = { error: null, email: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, initialState);
  // Lets the person check what they typed (useful on a phone keyboard).
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            className="h-11 rounded-[10px] bg-pos-surface pr-12 text-base"
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute top-0 right-0 inline-flex h-11 w-11 items-center justify-center rounded-[10px] text-pos-text-muted hover:text-pos-text focus-visible:outline-2 focus-visible:outline-pos-accent"
          >
            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
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
