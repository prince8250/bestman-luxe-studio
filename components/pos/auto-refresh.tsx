"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

// Reloads the page's server data every `seconds` while it is on screen, and
// at once when the tab comes back into view. What the user typed or opened
// (a dialog) is kept: router.refresh only fetches new data.
export function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = window.setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);
  return null;
}
