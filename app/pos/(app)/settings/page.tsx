import type { Metadata } from "next";

import { PageHeader } from "@/components/brand-pos/page-header";
import { OwnerOnly } from "@/components/pos/owner-only";
import { CounterAccounts } from "@/components/pos/settings/counter-accounts";
import { SampleData } from "@/components/pos/settings/sample-data";
import { SettingsForm, type SettingsFormValues } from "@/components/pos/settings/settings-form";
import { pageAccess } from "@/lib/auth/require-pos-user";
import { pesewasToInput } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { ALERT_KINDS, SOCIAL_NETWORKS, WEEKDAYS, type CounterAccountRow } from "@/lib/settings/schema";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { allowed } = await pageAccess("settings.edit");
  if (!allowed) return <OwnerOnly />;

  const supabase = await createSupabaseServerClient();
  const [settingsResult, counterResult, signInsResult, sampleResult] = await Promise.all([
    supabase.from("studio_settings").select("*").eq("id", true).single(),
    supabase.from("profiles").select("id, display_name, active").eq("role", "counter").order("display_name"),
    supabase.from("sign_in_events").select("profile_id, signed_in_at").order("signed_in_at", { ascending: false }).limit(500),
    supabase.rpc("sample_data_summary"),
  ]);
  if (settingsResult.error || counterResult.error) throw new Error("Could not load settings");
  const settings = settingsResult.data;

  // Emails live in Supabase Auth; read them with the service role (the owner
  // check above has already passed).
  const admin = createSupabaseAdminClient();
  const emails = new Map<string, string | null>();
  await Promise.all(
    counterResult.data.map(async (account) => {
      const { data } = await admin.auth.admin.getUserById(account.id);
      emails.set(account.id, data.user?.email ?? null);
    }),
  );
  const lastSignIn = new Map<string, string>();
  for (const event of signInsResult.data ?? []) {
    if (!lastSignIn.has(event.profile_id)) lastSignIn.set(event.profile_id, event.signed_in_at);
  }
  const accounts: CounterAccountRow[] = counterResult.data.map((account) => ({
    id: account.id,
    displayName: account.display_name,
    email: emails.get(account.id) ?? null,
    active: account.active,
    lastSignInAt: lastSignIn.get(account.id) ?? null,
  }));

  const hours = (settings.opening_hours ?? []) as { day: string; hours: string }[];
  const social = (settings.social_links ?? {}) as Record<string, string>;
  const alerts = (settings.alert_settings ?? {}) as Record<string, boolean>;
  const initial: SettingsFormValues = {
    studioName: settings.studio_name,
    phone: settings.phone ? formatPhone(settings.phone) : "",
    whatsapp: settings.whatsapp ? formatPhone(settings.whatsapp) : "",
    address: settings.address ?? "",
    mapUrl: settings.map_url ?? "",
    openingHours: WEEKDAYS.map((day) => ({ day, hours: hours.find((row) => row.day === day)?.hours ?? "" })),
    socialLinks: Object.fromEntries(SOCIAL_NETWORKS.map((network) => [network, social[network] ?? ""])),
    aboutText: settings.about_text ?? "",
    receiptHeader: settings.receipt_header ?? "",
    receiptFooter: settings.receipt_footer ?? "",
    receiptCopies: String(settings.receipt_copies),
    bookingSound: settings.booking_sound,
    maxCounterDiscountPercent: String(settings.max_counter_discount_percent),
    counterBackdateDays: String(settings.counter_backdate_days),
    defaultOpeningFloat: pesewasToInput(settings.default_opening_float),
    cashDifferenceTolerance: pesewasToInput(settings.cash_difference_tolerance),
    overrideAlertThreshold: pesewasToInput(settings.override_alert_threshold),
    ownerAlertPhone: settings.owner_alert_phone ? formatPhone(settings.owner_alert_phone) : "",
    alertSettings: Object.fromEntries(ALERT_KINDS.map((kind) => [kind.key, alerts[kind.key] ?? true])),
    dailySmsCap: String(settings.daily_sms_cap),
  };

  return (
    <main className="mx-auto w-full max-w-[1100px] flex-1 p-4 md:p-8">
      <PageHeader title="Settings" description="Studio details, receipts, counter controls, alerts, and accounts." />
      <div className="space-y-6">
        <SettingsForm initial={initial} />
        <CounterAccounts accounts={accounts} />
        <SampleData summary={(sampleResult.data ?? {}) as Record<string, number>} />
      </div>
    </main>
  );
}
