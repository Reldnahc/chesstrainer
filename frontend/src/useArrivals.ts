import { useRef } from "react";

/**
 * Remembers the keys a list showed once its data first loaded, so rows added
 * later (by polling, an action or showing more) can grow in with `data-arrived`
 * while the first load appears all at once with its page.
 */
export default function useArrivals(keys: readonly (string | number)[], ready = true) {
  const initial = useRef<Set<string | number> | null>(null);
  if (ready) initial.current ??= new Set(keys);
  return (key: string | number) => !initial.current || initial.current.has(key) ? undefined : true;
}
