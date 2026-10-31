const control =
  "h-11 rounded-[10px] border border-pos-border bg-pos-surface px-3 text-base text-pos-text md:text-sm focus-visible:outline-2 focus-visible:outline-pos-accent";

// Go to another day, week (any date in it), or month. A plain GET form, so it
// works before any JavaScript loads.
export function DateJump({
  action,
  name,
  type,
  value,
  max,
  label,
}: {
  action: string;
  name: string;
  type: "date" | "month";
  value: string;
  max: string;
  label: string;
}) {
  return (
    <form action={action} className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`jump-${name}`}>
        {label}
      </label>
      <input id={`jump-${name}`} name={name} type={type} defaultValue={value} max={max} required className={control} />
      <button type="submit" className={`${control} font-medium hover:bg-pos-subtle`}>
        Go
      </button>
    </form>
  );
}

// A custom range: from and to dates.
export function RangeJump({ action, from, to, max }: { action: string; from: string; to: string; max: string }) {
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-pos-text-muted">From</span>
        <input name="from" type="date" defaultValue={from} max={max} required className={control} />
      </label>
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-pos-text-muted">To</span>
        <input name="to" type="date" defaultValue={to} max={max} required className={control} />
      </label>
      <button type="submit" className={`${control} font-medium hover:bg-pos-subtle`}>
        Show
      </button>
    </form>
  );
}
