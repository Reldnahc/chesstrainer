import { useLayoutEffect, useRef, type KeyboardEvent, type RefObject, type SyntheticEvent } from "react";

/** Mount a native modal, then return focus when its owner dismisses it. */
export default function useModalDialog(
  onDismiss: () => void,
  fallbackFocus?: RefObject<HTMLElement | null>,
) {
  const ref = useRef<HTMLDialogElement>(null);
  useLayoutEffect(() => {
    const element = ref.current!;
    const opener = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    element.showModal();
    return () => {
      element.close();
      const target = opener?.isConnected && opener !== document.body
        ? opener
        : fallbackFocus?.current;
      target?.focus({ preventScroll: true });
      if (document.activeElement !== target)
        fallbackFocus?.current?.focus({ preventScroll: true });
    };
  }, [fallbackFocus]);

  return {
    ref,
    onCancel: (event: SyntheticEvent<HTMLDialogElement>) => {
      // The owner unmounts the dialog, keeping native and React state together.
      event.preventDefault();
      onDismiss();
    },
    onKeyDown: (event: KeyboardEvent<HTMLDialogElement>) => {
      // Keep page shortcuts out of the modal; native Tab and Escape still work.
      event.stopPropagation();
    },
  };
}
