import { useEffect, useState } from "react";

export const MOVE_DURATION_MS = 280;
// Finish the attempted move before showing the opponent's immediate reply.
export const COUNTER_REPLY_DELAY_MS = MOVE_DURATION_MS + 120;

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}
