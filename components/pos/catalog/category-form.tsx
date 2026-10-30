"use client";

import * as React from "react";
import { toast } from "sonner";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Field, FormError, ImagePicker, posInputClass } from "@/components/pos/form-fields";
import { Input } from "@/components/ui/input";
import { categoryInputSchema, type CategoryRow } from "@/lib/catalog/schema";
import { discardUpload, uploadImage } from "@/lib/images/upload";

import { saveCategoryAction } from "@/app/pos/(app)/services/actions";

type FieldKey = "name" | "tagline" | "sortOrder" | "imagePath";

// Add or edit a category: the website's service panels and the New sale tabs.
export function CategoryForm({
  category,
  nextSortOrder,
  onDone,
}: {
  category: CategoryRow | null;
  nextSortOrder: number;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(category?.name ?? "");
  const [tagline, setTagline] = React.useState(category?.tagline ?? "");
  const [sortOrder, setSortOrder] = React.useState(String(category?.sortOrder ?? nextSortOrder));
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imageRemoved, setImageRemoved] = React.useState(false);
  const [errors, setErrors] = React.useState<Partial<Record<FieldKey, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const draft = {
      id: category?.id,
      name,
      tagline,
      sortOrder,
      imagePath: imageRemoved ? null : (category?.imagePath ?? null),
    };
    const check = categoryInputSchema.safeParse(draft);
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
        // Category photos fill the tall website panels, so they keep more pixels.
        uploaded = await uploadImage("catalog", imageFile, { folder: "categories", maxEdge: 1600 });
        draft.imagePath = uploaded;
      }
      const result = await saveCategoryAction(draft);
      if (!result.ok) {
        if (uploaded) await discardUpload("catalog", uploaded);
        setFormError(result.error);
        return;
      }
      toast.success(category ? `${name.trim()} saved` : `${name.trim()} added`);
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
        currentUrl={category?.imageUrl ?? null}
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
      <Field id="category-name" label="Name" error={errors.name}>
        <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} className={posInputClass} />
      </Field>
      <Field id="category-tagline" label="Tagline (optional)" hint="One short line under the name on the website." error={errors.tagline}>
        <Input id="category-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} className={posInputClass} />
      </Field>
      <Field id="category-sort" label="Order" hint="Lower numbers come first." error={errors.sortOrder}>
        <Input
          id="category-sort"
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
          {pending ? "Saving…" : category ? "Save changes" : "Add category"}
        </PosButton>
        <PosButton type="button" variant="secondary" size="lg" onClick={onDone} disabled={pending}>
          Cancel
        </PosButton>
      </div>
    </form>
  );
}
