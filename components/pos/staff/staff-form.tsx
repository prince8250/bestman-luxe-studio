"use client";

import * as React from "react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Field, FormError, ImagePicker, posInputClass, ToggleRow } from "@/components/pos/form-fields";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { discardUpload, uploadImage } from "@/lib/images/upload";
import { formatPhone } from "@/lib/phone";
import { staffInputSchema, type StaffRow } from "@/lib/staff/schema";

import { saveStaffAction } from "@/app/pos/(app)/staff/actions";

interface StaffFormProps {
  member: StaffRow | null;
  nextSortOrder: number;
  onDone: () => void;
}

type FieldErrors = Partial<Record<"name" | "title" | "phone" | "bio" | "sortOrder" | "photoPath", string>>;

const inputClass = posInputClass;

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
        uploadedPath = await uploadImage("staff", photoFile, { folder: member?.id ?? crypto.randomUUID(), maxEdge: 800 });
        draft.photoPath = uploadedPath;
      }

      const result = await saveStaffAction(draft);
      if (!result.ok) {
        if (uploadedPath) await discardUpload("staff", uploadedPath);
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
      <ImagePicker
        shape="circle"
        currentUrl={member?.photoUrl ?? null}
        file={photoFile}
        removed={photoRemoved}
        fallback={name.trim().charAt(0) || "?"}
        onFile={(file) => {
          setPhotoFile(file);
          if (file) setPhotoRemoved(false);
        }}
        onRemove={() => {
          setPhotoFile(null);
          setPhotoRemoved(true);
        }}
      />

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

      <FormError message={formError ?? errors.photoPath} />

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

