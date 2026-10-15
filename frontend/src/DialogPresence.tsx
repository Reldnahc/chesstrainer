import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { playLeavingCopy } from "./ghost";
import { useInterfaceMotion } from "./MotionProvider";

/**
 * `<DialogPresence>{open && <SomeDialog …/>}</DialogPresence>`: when the owner
 * dismisses a modal, it closes and unmounts at once (useModalDialog restores
 * focus and the page is usable again), while a decorative copy of it plays the
 * closing animation (`dialog[data-closing]` in reveal.css) in the top layer and
 * removes itself. The copy holds no live controls or text.
 */
export default function DialogPresence({ children }: { children: ReactNode }) {
  const motion = useInterfaceMotion();
  const open = children !== null && children !== undefined && children !== false;
  // The last children shown while open, kept after commit so the closing render
  // can still find the dialog it is about to copy.
  const last = useRef<ReactNode>(null);
  useLayoutEffect(() => {
    if (open) last.current = children;
  });
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (open || !mounted) return;
    const dialog = ref.current?.querySelector("dialog");
    if (motion !== "still" && dialog?.open) playLeavingCopy(dialog, copy => { copy.dataset.closing = "true"; });
    last.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- unmounts only after the closing render's dialog has been copied from the DOM
    setMounted(false);
  }, [open, mounted, motion]);
  if (!mounted) return null;
  // The wrapper never boxes: the dialog renders in the top layer.
  // eslint-disable-next-line react-hooks/refs -- the closing render shows the last open children once more so the effect can copy that dialog
  return <div ref={ref} style={{ display: "contents" }}>{open ? children : last.current}</div>;
}
