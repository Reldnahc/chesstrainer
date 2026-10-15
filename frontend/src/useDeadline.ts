import { useEffect, useState } from "react";

/** Whether the clock has passed `deadline` (a Date.now() time). One timer is set
 * for the deadline itself, so nothing re-renders while waiting; null never passes. */
export function useDeadline(deadline: number | null): boolean {
  const [passed, setPassed] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setTimeout(() => setPassed(deadline), Math.max(0, deadline - Date.now()));
    return () => window.clearTimeout(timer);
  }, [deadline]);
  return deadline !== null && passed === deadline;
}
