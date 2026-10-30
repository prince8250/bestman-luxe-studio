"use client";

import * as React from "react";
import Form from "next/form";
import { Search } from "lucide-react";

// Top-bar Find: a receipt number, booking code, or customer phone.
// Ctrl+K (Cmd+K on a Mac) focuses it from anywhere in the POS.
export function FindBox() {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Form action="/pos/find" role="search" className="relative w-full max-w-md">
      <label htmlFor="pos-find" className="sr-only">
        Find a receipt, booking code, or phone number
      </label>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-pos-text-muted" />
      <input
        ref={inputRef}
        id="pos-find"
        name="q"
        type="search"
        autoComplete="off"
        placeholder="Find receipt, booking code, or phone"
        className="h-11 w-full rounded-[10px] border border-pos-border bg-pos-bg pr-16 pl-9 text-sm text-pos-text placeholder:text-pos-text-muted focus-visible:border-pos-accent focus-visible:outline-2 focus-visible:outline-pos-accent/30"
      />
      <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-pos-border bg-pos-surface px-1.5 py-0.5 font-text text-xs text-pos-text-muted sm:block">
        Ctrl K
      </kbd>
    </Form>
  );
}
