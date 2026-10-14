import { useLayoutEffect, useRef } from "react";

/** A ref that always holds the latest value, updated after render rather than
 * during it, for callbacks that async work calls later. */
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => {
    ref.current = value;
  });
  return ref;
}
