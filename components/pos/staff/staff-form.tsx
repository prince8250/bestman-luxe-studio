"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/images/compress";
import { formatPhone } from "@/lib/phone";
import { staffInputSchema, type StaffRow } from "@/lib/staff/schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { saveStaffAction } from "@/app/pos/(app)/staff/actions";

interface StaffFormProps {
  member: StaffRow | null;
  nextSortOrder: number;
  onDone: () => void;
}

type FieldErrors = Partial<Record<"name" | "title" | "phone" | "bio" | "sortOrder" | "photoPath", string>>;

const inputClass = "h-11 rounded-[10px] bg-pos-surface text-base md:text-sm";

// Add or edit one staff member. The photo is resized in the browser (long
// edge 800px, WebP) and uploaded to the staff bucket only when the owner
// presses Save; the database stores the path, never the image.
export function StaffForm({ member, nextSortOrder, onDone }: StaffFormProps) {
  const [name, setName] = React.useState(member?.name ?? "");
  const [title, setTitle] = React.useState(member?.title ?? "");
  const [phone, setPhone] = React.useState(member?.phone ? formatPhone(member.phone) : "");
  const [bio, setBio] = React.useState(member?.bio ?? "");
  const [sortOrder, setSortOrder] = React.useState(String(member?.sortOrder ?? nextSortOrder));
  const [showOnWebsite, setShowOnWebsite] = React.useState(member?.showOnWebsite ?? true);
  const [bookableOnline, setBookableOnline] = React.useState(member?.bookableOnline ?? true);
  const [photoFile, setPhotoFile] = React.useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const previewUrl = React.useMemo(() => (photoFile ? URL.createObjectURL(photoFile) : null), [photoFile]);
  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  const shownPhoto = previewUrl ?? (photoRemoved ? null : member?.photoUrl ?? null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const draft = {
      id: member?.id,
      name,
      title,
      phone,
      bio,
      sortOrder,
      showOnWebsite,
      bookableOnline,
      photoPath: photoRemoved ? null : (member?.photoPath ?? null),
    };
    const check = staffInputSchema.safeParse(draft);
    if (!check.success) {
      const next: FieldErrors = {};
      for (const issue of check.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);

    let uploadedPath: string | null = null;
    try {
      if (photoFile) {
        const image = await compressImage(photoFile, { maxEdge: 800, quality: 0.8 });
        const folder = member?.id ?? crypto.randomUUID();
        uploadedPath = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${image.extension}`;
        const supabase = createSupabaseBrowserClient();
        const { error } = await supabase.storage.from("staff").upload(uploadedPath, image.blob, {
          contentType: image.blob.type,
          cacheControl: "31536000",
        });
        if (error) throw new Error("The photo could not be uploaded. Check the internet connection.");
        draft.photoPath = uploadedPath;
      }

      const result = await saveStaffAction(draft);
      if (!result.ok) {
        if (uploadedPath) await createSupabaseBrowserClient().storage.from("staff").remove([uploadedPath]);
        setFormError(result.error);
        return;
      }
      toast.success(member ? `${name.trim()} saved` : `${name.trim()} added`);
      onDone();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not save. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 px-4 pb-6" noValidate>
      <div className="flex items-center gap-4">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-pos-subtle">
          {shownPhoto ? (
            <Image src={shownPhoto} alt="" fill sizes="80px" className="object-cover" unoptimized={Boolean(previewUrl)} />
          ) : (
            <span className="display-type flex h-full w-full items-center justify-center text-3xl text-pos-text-muted">
              {name.trim().charAt(0) || "?"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-pos-border bg-pos-surface px-4 text-sm font-medium hover:bg-pos-subtle focus-within:outline-2 focus-within:outline-pos-accent">
            <ImagePlus className="h-5 w-5" />
            {shownPhoto ? "Change photo" : "Add photo"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setPhotoFile(file);
                if (file) setPhotoRemoved(false);
              }}
            />
          </label>
          {shownPhoto && (
            <PosButton
              type="button"
              variant="ghost"
              onClick={() => {
                setPhotoFile(null);
                setPhotoRemoved(true);
              }}
            >
              <Trash2 /> Remove photo
            </PosButton>
          )}
        </div>
      </div>

      <Field id="staff-name" label="Name" error={errors.name}>
        <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} autoFocus />
      </Field>
      <Field id="staff-title" label="Title (optional)" hint="For example Barber or Nail Tech." error={errors.title}>
        <Input id="staff-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </Field>
      <Field id="staff-phone" label="Phone (optional, internal only)" hint="Never shown on the website." error={errors.phone}>
        <Input
          id="staff-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="024 123 4567"
          className={inputClass}
        />
      </Field>
      <Field id="staff-bio" label="Short bio (optional)" hint="Shown on the website booking page." error={errors.bio}>
        <Textarea id="staff-bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="rounded-[10px] bg-pos-surface text-base md:text-sm" />
      </Field>
      <Field id="staff-sort" label="Order in lists" hint="Lower numbers come first." error={errors.sortOrder}>
        <Input
          id="staff-sort"
          type="number"
          inputMode="numeric"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={`${inputClass} w-32`}
        />
      </Field>

      <ToggleRow
        id="staff-website"
        label="Show on the website"
        hint="Name, title, photo, and bio appear on the website."
        checked={showOnWebsite}
        onChange={setShowOnWebsite}
      />
      <ToggleRow
        id="staff-online"
        label="Can be booked online"
        hint="Visitors can choose this person when booking."
        checked={bookableOnline}
        onChange={setBookableOnline}
      />

      {(formError || errors.photoPath) && (
        <p role="alert" className="rounded-[10px] bg-pos-down-soft px-3 py-2.5 text-sm text-pos-down">
          {formError ?? errors.photoPath}
        </p>
      )}

      <div className="flex gap-2 pt-2">
        <PosButton type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Saving…" : member ? "Save changes" : "Add staff member"}
        </PosButton>
        <PosButton type="button" variant="secondary" size="lg" onClick={onDone} disabled={pending}>
          Cancel
        </PosButton>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-pos-down" id={`${id}-error`}>
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-pos-text-muted">{hint}</p>
      )}
    </div>
  );
}

function ToggleRow({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 rounded-[10px] border border-pos-border px-3 py-2">
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-0.5 text-xs text-pos-text-muted">{hint}</p>
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
