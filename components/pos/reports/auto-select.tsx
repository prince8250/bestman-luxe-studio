"use client";

const control =
  "h-11 max-w-[calc(100vw-2rem)] rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base text-pos-text md:text-sm focus-visible:outline-2 focus-visible:outline-pos-accent";

// A filter select that applies itself (submits its form) when changed.
export function AutoSelect({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex max-w-full min-w-0 items-center">
      <span className="sr-only">{label}</span>
      <select name={name} defaultValue={value} onChange={(event) => event.currentTarget.form?.requestSubmit()} className={control}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
