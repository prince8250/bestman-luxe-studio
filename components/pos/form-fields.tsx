"use client";

import * as React from "react";
import Image from "next/image";
import { ImagePlus, Trash2 } from "lucide-react";

import { PosButton } from "@/components/brand-pos/pos-button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

// Small building blocks shared by the POS forms (staff, services, categories,
// gallery, offers, settings), so every form looks and behaves the same.

// 44px tall, 16px text on phones (stops iOS zooming into the field).
export const posInputClass = "h-11 rounded-[10px] bg-pos-surface text-base md:text-sm";

export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: React.ReactNode;
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

export function ToggleRow({
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

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[10px] bg-pos-down-soft px-3 py-2.5 text-sm text-pos-down">
      {message}
    </p>
  );
}

// Chooses an image to upload on save. The preview is local until then.
export function ImagePicker({
  currentUrl,
  file,
  removed,
  onFile,
  onRemove,
  shape = "square",
  fallback,
}: {
  currentUrl: string | null;
  file: File | null;
  removed: boolean;
  onFile: (file: File | null) => void;
  onRemove: () => void;
  shape?: "circle" | "square";
  fallback?: React.ReactNode;
}) {
  const previewUrl = React.useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);
  const shown = previewUrl ?? (removed ? null : currentUrl);

  return (
    <div className="flex items-center gap-4">
      <div
        className={cn(
          "relative h-20 w-20 shrink-0 overflow-hidden bg-pos-subtle",
          shape === "circle" ? "rounded-full" : "rounded-[12px]",
        )}
      >
        {shown ? (
          <Image src={shown} alt="" fill sizes="80px" className="object-cover" unoptimized={Boolean(previewUrl)} />
        ) : (
          <span className="display-type flex h-full w-full items-center justify-center text-3xl text-pos-text-muted">
            {fallback ?? "?"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border border-pos-border bg-pos-surface px-4 text-sm font-medium hover:bg-pos-subtle focus-within:outline-2 focus-within:outline-pos-accent">
          <ImagePlus className="h-5 w-5" />
          {shown ? "Change photo" : "Add photo"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          />
        </label>
        {shown && (
          <PosButton type="button" variant="ghost" onClick={onRemove}>
            <Trash2 /> Remove photo
          </PosButton>
        )}
      </div>
    </div>
  );
}
