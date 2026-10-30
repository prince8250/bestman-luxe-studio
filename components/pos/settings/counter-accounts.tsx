"use client";

import * as React from "react";
import { KeyRound, LogOut, Plus, Power, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { Field, FormError, posInputClass } from "@/components/pos/form-fields";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { ActionResult } from "@/lib/actions/result";
import { counterAccountSchema, type CounterAccountRow } from "@/lib/settings/schema";
import { formatAccraDayTime } from "@/lib/time";
import { cn } from "@/lib/utils";

import {
  createCounterAccountAction,
  resetCounterPasswordAction,
  setCounterActiveAction,
  signOutCounterEverywhereAction,
} from "@/app/pos/(app)/settings/actions";

// No look-alike characters, so the owner can read it out to the employee.
function temporaryPassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

type Dialogs =
  | { kind: "create" }
  | { kind: "reset"; account: CounterAccountRow }
  | { kind: "signout"; account: CounterAccountRow }
  | { kind: "active"; account: CounterAccountRow }
  | null;

// One counter account per employee who uses the counter PC, so every sale,
// change, and close is traceable to a person.
export function CounterAccounts({ accounts }: { accounts: CounterAccountRow[] }) {
  const [dialog, setDialog] = React.useState<Dialogs>(null);

  return (
    <PosCard
      title="Counter accounts"
      actions={
        <PosButton onClick={() => setDialog({ kind: "create" })}>
          <Plus /> Add account
        </PosButton>
      }
    >
      <p className="-mt-2 mb-4 text-sm text-pos-text-muted">
        One account for each employee who uses the counter PC. When someone leaves, deactivate their account.
      </p>
      {accounts.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-pos-border p-6 text-center text-sm text-pos-text-muted">
          No counter accounts yet.
        </p>
      ) : (
        <ul className="divide-y divide-pos-border rounded-[10px] border border-pos-border">
          {accounts.map((account) => (
            <li key={account.id} className={cn("flex flex-wrap items-center gap-3 p-3", !account.active && "bg-pos-bg")}>
              <div className="min-w-0 flex-1 basis-56">
                <p className="font-medium">
                  {account.displayName}
                  {!account.active && (
                    <span className="ml-2 rounded-md bg-pos-subtle px-2 py-0.5 text-xs text-pos-text-muted">Deactivated</span>
                  )}
                </p>
                <p className="truncate text-sm text-pos-text-muted">{account.email ?? "No email"}</p>
                <p className="text-xs text-pos-text-muted">
                  {account.lastSignInAt ? `Last signed in ${formatAccraDayTime(account.lastSignInAt)}` : "Never signed in"}
                </p>
              </div>
              <div className="flex flex-wrap gap-1">
                {account.active && (
                  <>
                    <PosButton variant="secondary" onClick={() => setDialog({ kind: "reset", account })}>
                      <KeyRound /> New password
                    </PosButton>
                    <PosButton variant="ghost" onClick={() => setDialog({ kind: "signout", account })}>
                      <LogOut /> Sign out everywhere
                    </PosButton>
                  </>
                )}
                <PosButton variant="ghost" onClick={() => setDialog({ kind: "active", account })}>
                  <Power /> {account.active ? "Deactivate" : "Reactivate"}
                </PosButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="rounded-[16px] sm:max-w-md">
          {dialog?.kind === "create" && <CreateAccount onDone={() => setDialog(null)} />}
          {dialog?.kind === "reset" && <ResetPassword account={dialog.account} onDone={() => setDialog(null)} />}
          {dialog?.kind === "signout" && (
            <Confirm
              title={`Sign ${dialog.account.displayName} out everywhere?`}
              body="They are signed out on every PC and phone at once and must sign in again with their password."
              button="Sign out everywhere"
              action={() => signOutCounterEverywhereAction(dialog.account.id)}
              success={`${dialog.account.displayName} was signed out everywhere`}
              onDone={() => setDialog(null)}
            />
          )}
          {dialog?.kind === "active" && (
            <Confirm
              title={dialog.account.active ? `Deactivate ${dialog.account.displayName}?` : `Reactivate ${dialog.account.displayName}?`}
              body={
                dialog.account.active
                  ? "They are signed out everywhere at once and cannot sign in again. Their sales and changes stay in the history with their name."
                  : "They can sign in again with their current password."
              }
              button={dialog.account.active ? "Deactivate" : "Reactivate"}
              danger={dialog.account.active}
              action={() => setCounterActiveAction(dialog.account.id, !dialog.account.active)}
              success={dialog.account.active ? `${dialog.account.displayName} deactivated` : `${dialog.account.displayName} reactivated`}
              onDone={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </PosCard>
  );
}

function CreateAccount({ onDone }: { onDone: () => void }) {
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState(temporaryPassword);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = counterAccountSchema.safeParse({ displayName, email, password });
    if (!check.success) {
      const next: Record<string, string> = {};
      for (const issue of check.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const result = await createCounterAccountAction(check.data);
      if (!result.ok) return setFormError(result.error);
      toast.success(`Account created for ${displayName.trim()}. Give them the email and temporary password.`);
      onDone();
    } catch {
      setFormError("Could not reach the server. Check the internet connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="display-type text-3xl">Add counter account</DialogTitle>
        <DialogDescription>For one employee. They sign in with this email and password at the counter.</DialogDescription>
      </DialogHeader>
      <Field id="account-name" label="Name shown in the POS" hint='For example "Abena (counter)".' error={errors.displayName}>
        <Input id="account-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={posInputClass} />
      </Field>
      <Field id="account-email" label="Email" error={errors.email}>
        <Input
          id="account-email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={posInputClass}
        />
      </Field>
      <Field id="account-password" label="Temporary password" hint="Write it down and give it to the employee." error={errors.password}>
        <div className="flex gap-2">
          <Input
            id="account-password"
            value={password}
            autoComplete="off"
            onChange={(e) => setPassword(e.target.value)}
            className={`${posInputClass} font-mono`}
          />
          <PosButton variant="secondary" size="icon" aria-label="Make a new password" onClick={() => setPassword(temporaryPassword())}>
            <RefreshCw />
          </PosButton>
        </div>
      </Field>
      <FormError message={formError} />
      <DialogFooter>
        <PosButton type="submit" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </PosButton>
      </DialogFooter>
    </form>
  );
}

function ResetPassword({ account, onDone }: { account: CounterAccountRow; onDone: () => void }) {
  const [password, setPassword] = React.useState(temporaryPassword);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      const result = await resetCounterPasswordAction({ id: account.id, password });
      if (!result.ok) return setError(result.error);
      toast.success(`New password set for ${account.displayName}. They were signed out everywhere.`);
      onDone();
    } catch {
      setError("Could not reach the server. Check the internet connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <DialogHeader>
        <DialogTitle className="display-type text-3xl">New password</DialogTitle>
        <DialogDescription>
          For {account.displayName}. They are signed out everywhere and must sign in with the new password.
        </DialogDescription>
      </DialogHeader>
      <Field id="reset-password" label="New temporary password" hint="Write it down and give it to the employee.">
        <div className="flex gap-2">
          <Input
            id="reset-password"
            value={password}
            autoComplete="off"
            onChange={(e) => setPassword(e.target.value)}
            className={`${posInputClass} font-mono`}
          />
          <PosButton variant="secondary" size="icon" aria-label="Make a new password" onClick={() => setPassword(temporaryPassword())}>
            <RefreshCw />
          </PosButton>
        </div>
      </Field>
      <FormError message={error} />
      <DialogFooter>
        <PosButton type="submit" disabled={pending}>
          {pending ? "Saving…" : "Set new password"}
        </PosButton>
      </DialogFooter>
    </form>
  );
}

function Confirm({
  title,
  body,
  button,
  danger,
  action,
  success,
  onDone,
}: {
  title: string;
  body: string;
  button: string;
  danger?: boolean;
  action: () => Promise<ActionResult>;
  success: string;
  onDone: () => void;
}) {
  const [pending, setPending] = React.useState(false);
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{body}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <PosButton variant="secondary" onClick={onDone}>
          Cancel
        </PosButton>
        <PosButton
          variant={danger ? "danger" : "primary"}
          disabled={pending}
          onClick={async () => {
            setPending(true);
            try {
              const result = await action();
              if (result.ok) {
                toast.success(success);
                onDone();
              } else toast.error(result.error);
            } catch {
              toast.error("Could not reach the server. Check the internet connection and try again.");
            } finally {
              setPending(false);
            }
          }}
        >
          {button}
        </PosButton>
      </DialogFooter>
    </>
  );
}
