"use client";

import * as React from "react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import { PosCard } from "@/components/brand-pos/pos-card";
import { Field, FormError, posInputClass, ToggleRow } from "@/components/pos/form-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ALERT_KINDS, settingsInputSchema, SOCIAL_NETWORKS, type AlertKind } from "@/lib/settings/schema";
import { requestErrorMessage } from "@/lib/actions/request-error";

import { saveSettingsAction } from "@/app/pos/(app)/settings/actions";

export interface SettingsFormValues {
  studioName: string;
  phone: string;
  whatsapp: string;
  address: string;
  mapUrl: string;
  openingHours: { day: string; hours: string }[];
  socialLinks: Record<string, string>;
  aboutText: string;
  receiptHeader: string;
  receiptFooter: string;
  receiptCopies: string;
  bookingSound: boolean;
  maxCounterDiscountPercent: string;
  counterBackdateDays: string;
  defaultOpeningFloat: string;
  cashDifferenceTolerance: string;
  overrideAlertThreshold: string;
  ownerAlertPhone: string;
  alertSettings: Record<string, boolean>;
  dailySmsCap: string;
}

const SOCIAL_LABELS: Record<(typeof SOCIAL_NETWORKS)[number], string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  x: "X (Twitter)",
};

// Studio details, receipts, counter controls, and owner alerts in one form.
// Every changed setting is logged (old and new value) by the database.
export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const set = <K extends keyof SettingsFormValues>(key: K, value: SettingsFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const check = settingsInputSchema.safeParse(values);
    if (!check.success) {
      const next: Record<string, string> = {};
      for (const issue of check.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFormError("Some settings need fixing (marked in red).");
      document.querySelector(`[data-field="${check.error.issues[0].path.join(".")}"]`)?.scrollIntoView({ block: "center" });
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const result = await saveSettingsAction(values);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      toast.success("Settings saved");
    } catch (error) {
      setFormError(requestErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const text = (key: keyof SettingsFormValues, label: string, hint?: string, props?: React.ComponentProps<typeof Input>) => (
    <div data-field={key}>
      <Field id={`settings-${key}`} label={label} hint={hint} error={errors[key]}>
        <Input
          id={`settings-${key}`}
          value={values[key] as string}
          onChange={(event) => set(key, event.target.value as never)}
          className={posInputClass}
          {...props}
        />
      </Field>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-6">
      <PosCard title="Studio">
        <p className="-mt-2 mb-4 text-sm text-pos-text-muted">Shown on the website and on receipts.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {text("studioName", "Studio name")}
          {text("address", "Address", "For example: Asafo, near KsTU, Kumasi.")}
          {text("phone", "Phone", "Shown with a Call button.", { type: "tel", inputMode: "tel", placeholder: "024 456 5866" })}
          {text("whatsapp", "WhatsApp", "Opens a WhatsApp chat.", { type: "tel", inputMode: "tel", placeholder: "024 456 5866" })}
          <div className="md:col-span-2">{text("mapUrl", "Map link", "A Google Maps link to the studio (used for Directions).", { inputMode: "url", placeholder: "https://maps.google.com/..." })}</div>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Opening hours</legend>
          <p className="text-xs text-pos-text-muted">Write them as you want them shown, for example 08:00 – 20:00. Leave a day empty if closed.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {values.openingHours.map((row, index) => (
              <label key={row.day} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm">{row.day}</span>
                <Input
                  value={row.hours}
                  maxLength={40}
                  placeholder="Closed"
                  onChange={(event) =>
                    set(
                      "openingHours",
                      values.openingHours.map((current, i) => (i === index ? { ...current, hours: event.target.value } : current)),
                    )
                  }
                  className={posInputClass}
                />
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">Social media links</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {SOCIAL_NETWORKS.map((network) => (
              <div key={network} data-field={`socialLinks.${network}`}>
                <Field id={`settings-social-${network}`} label={SOCIAL_LABELS[network]} error={errors[`socialLinks.${network}`]}>
                  <Input
                    id={`settings-social-${network}`}
                    inputMode="url"
                    value={values.socialLinks[network] ?? ""}
                    onChange={(event) => set("socialLinks", { ...values.socialLinks, [network]: event.target.value })}
                    className={posInputClass}
                  />
                </Field>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="mt-5" data-field="aboutText">
          <Field id="settings-about" label="About the studio" hint="The About section on the website." error={errors.aboutText}>
            <Textarea
              id="settings-about"
              value={values.aboutText}
              onChange={(event) => set("aboutText", event.target.value)}
              rows={4}
              className="rounded-[10px] bg-pos-surface text-base md:text-sm"
            />
          </Field>
        </div>
      </PosCard>

      <PosCard title="Receipts">
        <div className="grid gap-4 md:grid-cols-2">
          {text("receiptHeader", "Receipt header", "Printed under the logo.")}
          {text("receiptFooter", "Receipt footer", "For example: Thank you! Book online at ...")}
          {text("receiptCopies", "Copies per sale", "2 = a customer copy and a STAFF COPY.", { type: "number", min: 1, max: 3, inputMode: "numeric" })}
        </div>
        <div className="mt-4">
          <ToggleRow
            id="settings-sound"
            label="Sound for new online bookings"
            hint="A short sound on the POS when a booking arrives."
            checked={values.bookingSound}
            onChange={(checked) => set("bookingSound", checked)}
          />
        </div>
      </PosCard>

      <PosCard title="Counter controls">
        <p className="-mt-2 mb-4 text-sm text-pos-text-muted">
          Limits for counter accounts. The owner has no discount or past-sale limit (up to 14 days).
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {text("maxCounterDiscountPercent", "Biggest counter discount (%)", "Bigger discounts need the owner.", { type: "number", min: 0, max: 100, inputMode: "numeric" })}
          {text("counterBackdateDays", "Past sales: days back", "How far back the counter may record a paper sale (0 to 14).", { type: "number", min: 0, max: 14, inputMode: "numeric" })}
          {text("defaultOpeningFloat", "Opening cash float (GHS)", "Cash in the drawer when the day starts.", { inputMode: "decimal" })}
          {text("cashDifferenceTolerance", "Cash difference allowed (GHS)", "A bigger difference at closing alerts the owner.", { inputMode: "decimal" })}
          {text("overrideAlertThreshold", "Big price change (GHS)", "A price changed by more than this on one line alerts the owner.", { inputMode: "decimal" })}
        </div>
      </PosCard>

      <PosCard title="Owner alerts">
        <p className="-mt-2 mb-4 text-sm text-pos-text-muted">
          Text messages to the owner&apos;s phone. Sending is switched on when the SMS service is connected.
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {text("ownerAlertPhone", "Owner's phone for alerts", undefined, { type: "tel", inputMode: "tel", placeholder: "024 456 5866" })}
          {text("dailySmsCap", "Most alerts per day", "After this, alerts stay in the Activity feed only.", { type: "number", min: 0, max: 200, inputMode: "numeric" })}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {ALERT_KINDS.map((kind) => (
            <ToggleRow
              key={kind.key}
              id={`settings-alert-${kind.key}`}
              label={kind.label}
              hint="Send a text message"
              checked={values.alertSettings[kind.key as AlertKind] ?? true}
              onChange={(checked) => set("alertSettings", { ...values.alertSettings, [kind.key]: checked })}
            />
          ))}
        </div>
      </PosCard>

      <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-[16px] border border-pos-border bg-pos-surface p-3 md:bottom-4">
        <PosButton type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </PosButton>
        <div className="min-w-0 flex-1">
          <FormError message={formError} />
        </div>
      </div>
    </form>
  );
}
