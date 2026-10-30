import { Construction } from "lucide-react";

import { PageHeader } from "@/components/brand-pos/page-header";
import { OwnerOnly } from "@/components/pos/owner-only";
import type { PosAction } from "@/lib/auth/permissions";
import { pageAccess } from "@/lib/auth/require-pos-user";

interface PlaceholderPageProps {
  title: string;
  permission: PosAction;
  /** One line on what this page will do once built. */
  description: string;
}

// TEMPORARY (spec 04): the real route structure, with the permission check
// already in place, before each section is built in its own spec.
export async function PlaceholderPage({ title, permission, description }: PlaceholderPageProps) {
  const { allowed } = await pageAccess(permission);
  if (!allowed) return <OwnerOnly />;

  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 p-4 md:p-8">
      <PageHeader title={title} />
      <div className="rounded-[16px] border border-dashed border-pos-border bg-pos-surface p-8 text-center">
        <Construction aria-hidden className="mx-auto h-7 w-7 text-pos-text-muted" />
        <p className="mt-3 font-medium">Not built yet</p>
        <p className="mt-1 text-sm text-pos-text-muted">{description}</p>
      </div>
    </main>
  );
}
