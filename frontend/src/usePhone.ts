import { useSyncExternalStore } from "react";

// The application's phone breakpoint, matching the CSS max-width: 760px queries.
const PHONE = "(max-width: 760px)";

/** True while the viewport is phone-sized; updates when it crosses the breakpoint. */
export default function usePhone() {
  return useSyncExternalStore(
    (change) => {
      const query = window.matchMedia(PHONE);
      query.addEventListener("change", change);
      return () => query.removeEventListener("change", change);
    },
    () => window.matchMedia(PHONE).matches,
  );
}
