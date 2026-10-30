"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Field, FormError, ImagePicker, posInputClass, ToggleRow } from "@/components/pos/form-fields";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { serviceInputSchema, type CategoryRow, type ServiceRow, type StaffOption } from "@/lib/catalog/schema";
import { discardUpload, uploadImage } from "@/lib/images/upload";
import { pesewasToInput } from "@/lib/money";
import { cn } from "@/lib/utils";

import { saveServiceAction } from "@/app/pos/(app)/services/actions";

type FieldKey = "categoryId" | "name" | "description" | "price" | "durationMinutes" | "sortOrder" | "imagePath";

interface ServiceFormProps {
  service: ServiceRow | null;
  categories: CategoryRow[];
  staff: StaffOption[];
  defaultCategoryId: string | null;
  nextSortOrder: number;
  onDone: () => void;
}

// Add or edit a service: details, price, time, who can do it, and visibility.
export function ServiceForm({ service, categories, staff, defaultCategoryId, nextSortOrder, onDone }: ServiceFormProps) {
  const [categoryId, setCategoryId] = React.useState(service?.categoryId ?? defaultCategoryId ?? "");
  const [name, setName] = React.useState(service?.name ?? "");
  const [description, setDescription] = React.useState(service?.description ?? "");
  const [price, setPrice] = React.useState(service ? pesewasToInput(service.price) : "");
  const [duration, setDuration] = React.useState(String(service?.durationMinutes ?? 45));
  const [sortOrder, setSortOrder] = React.useState(String(service?.sortOrder ?? nextSortOrder));
  const [showOnWebsite, setShowOnWebsite] = React.useState(service?.showOnWebsite ?? true);
  const [bookableOnline, setBookableOnline] = React.useState(service?.bookableOnline ?? true);
  const [staffIds, setStaffIds] = React.useState<string[]>(service?.staffIds ?? []);
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  // Only active staff can be picked; an archived person already assigned is
  // dropped on save (they no longer take bookings anyway).
  const activeStaffIds = new Set(staff.map((member) => member.id));

  function toggleStaff(id: string) {
    setStaffIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const draft = {
      id: service?.id,
      categoryId,
      name,
      description,
      price,
      durationMinutes: duration,
      sortOrder,
      showOnWebsite,
      bookableOnline,
      staffIds: staffIds.filter((id) => activeStaffIds.has(id)),
      imagePath: imageRemoved ? null : (service?.imagePath ?? null),
    };
    const check = serviceInputSchema.safeParse(draft);
    if (!check.success) {
      const next: Partial<Record<FieldKey, string>> = {};
      for (const issue of check.error.issues) next[issue.path[0] as FieldKey] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setPending(true);
    let uploaded: string | null = null;
    try {
      if (imageFile) {
        uploaded = await uploadImage("catalog", imageFile, { folder: "services", maxEdge: 1200 });
        draft.imagePath = uploaded;
      }
      const result = await saveServiceAction(draft);
      if (!result.ok) {
        if (uploaded) await discardUpload("catalog", uploaded);
        setFormError(result.error);
        return;
      }
      toast.success(service ? `${name.trim()} saved` : `${name.trim()} added`);
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
        currentUrl={service?.imageUrl ?? null}
        file={imageFile}
        removed={imageRemoved}
        fallback={name.trim().charAt(0) || "?"}
        onFile={(file) => {
          setImageFile(file);
          if (file) setImageRemoved(false);
        }}
        onRemove={() => {
          setImageFile(null);
          setImageRemoved(true);
        }}
      />

      <Field id="service-category" label="Category" error={errors.categoryId}>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger id="service-category" className="h-11 w-full rounded-[10px] bg-pos-surface">
            <SelectValue placeholder="Choose a category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
                {!category.active && " (removed)"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field id="service-name" label="Name" error={errors.name}>
        <Input id="service-name" value={name} onChange={(e) => setName(e.target.value)} className={posInputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          id="service-price"
          label="Price (GHS)"
          error={errors.price}
          hint="Changing the price never changes past sales."
        >
          <Input
            id="service-price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="50.00"
            className={posInputClass}
          />
        </Field>
        <Field id="service-duration" label="Time (minutes)" error={errors.durationMinutes} hint="Used for online booking.">
          <Input
            id="service-duration"
            type="number"
            inputMode="numeric"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className={posInputClass}
          />
        </Field>
      </div>

      <Field id="service-description" label="Description (optional)" hint="Shown on the website." error={errors.description}>
        <Textarea
          id="service-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="rounded-[10px] bg-pos-surface text-base md:text-sm"
        />
      </Field>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Who can do it</legend>
        <p className="text-xs text-pos-text-muted">
          Used for online booking and shown first in New sale. Anyone can still be picked at the counter.
        </p>
        {staff.length === 0 ? (
          <p className="text-sm text-pos-text-muted">Add staff first (Staff page).</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {staff.map((member) => {
              const selected = staffIds.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  role="checkbox"
                  aria-checked={selected}
                  onClick={() => toggleStaff(member.id)}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-3 text-sm font-medium focus-visible:outline-2 focus-visible:outline-pos-accent",
                    selected ? "border-pos-accent bg-pos-accent-soft text-pos-accent" : "border-pos-border bg-pos-surface",
                  )}
                >
                  {selected && <Check className="h-4 w-4" />}
                  {member.name}
                </button>
              );
            })}
          </div>
        )}
      </fieldset>

      <ToggleRow
        id="service-website"
        label="Show on the website"
        hint="Listed on the Services page with its price and time."
        checked={showOnWebsite}
        onChange={setShowOnWebsite}
      />
      <ToggleRow
        id="service-online"
        label="Can be booked online"
        hint='Otherwise the website says "Walk in or call".'
        checked={bookableOnline}
        onChange={setBookableOnline}
      />

      <Field id="service-sort" label="Order in lists" hint="Lower numbers come first." error={errors.sortOrder}>
        <Input
          id="service-sort"
          type="number"
          inputMode="numeric"
          min={0}
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          className={`${posInputClass} w-32`}
        />
      </Field>

      <FormError message={formError ?? errors.imagePath} />

      <div className="flex gap-2 pt-2">
        <PosButton type="submit" size="lg" disabled={pending} className="flex-1">
          {pending ? "Saving…" : service ? "Save changes" : "Add service"}
        </PosButton>
        <PosButton type="button" variant="secondary" size="lg" onClick={onDone} disabled={pending}>
          Cancel
        </PosButton>
      </div>
    </form>
  );
}
