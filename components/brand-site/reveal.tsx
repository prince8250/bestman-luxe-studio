"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface RevealProps extends React.HTMLAttributes<HTMLElement> {
  /** Element to render. Defaults to a div. */
  as?: "div" | "section" | "li" | "article" | "figure";
  /** Delay in milliseconds, for staggering a group (for example gallery tiles). */
  delay?: number;
}

// Scroll reveal for the website: the element fades up 24px the first time it
// enters the viewport, then stays. Only opacity and transform animate. The CSS
// in globals.css turns this into a plain fade under prefers-reduced-motion,
// and keeps content visible when JavaScript is off.
//
// The observer sets `data-revealed` on the element directly instead of using
// React state: the change is purely visual, so there is nothing to re-render.
export function Reveal({ as: Tag = "div", delay = 0, className, style, ...props }: RevealProps) {
  const ref = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const reveal = () => element.setAttribute("data-revealed", "");
    if (typeof IntersectionObserver === "undefined") {
      reveal();
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          reveal();
          observer.disconnect(); // once only
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={cn("reveal", className)}
      style={{ ...style, ["--reveal-delay" as string]: `${delay}ms` }}
      {...props}
    />
  );
}
