import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ghostCopy } from "./ghost";
import { useInterfaceMotion } from "./MotionProvider";

/**
 * `<DialogPresence>{open && <SomeDialog …/>}</DialogPresence>`: when the owner
 * dismisses a modal, it closes and unmounts at once (useModalDialog restores
 * focus and the page is usable again), while a decorative copy of it plays the
 * closing animation (`dialog[data-closing]` in reveal.css) in the top layer and
 * removes itself. The copy holds no live controls or text.
 */
function leave(dialog: HTMLDialogElement) {
  const copy = ghostCopy(dialog);
  copy.dataset.closing = "true";
  copy.inert = true;
  copy.popover = "manual";
  document.body.append(copy);
  copy.showPopover();
  const running = copy.getAnimations();
  const remove = () => copy.remove();
  if (!running.length) remove();
  else Promise.all(running.map(animation => animation.finished)).then(remove, remove);
}

export default function DialogPresence({ children }: { children: ReactNode }) {
  const motion = useInterfaceMotion();
  const open = children !== null && children !== undefined && children !== false;
  const last = useRef<ReactNode>(null);
  if (open) last.current = children;
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (open || !mounted) return;
    const dialog = ref.current?.querySelector("dialog");
    if (motion !== "still" && dialog?.open) leave(dialog);
    last.current = null;
    setMounted(false);
  }, [open, mounted, motion]);
  if (!mounted) return null;
  // The wrapper never boxes: the dialog renders in the top layer.
  return <div ref={ref} style={{ display: "contents" }}>{open ? children : last.current}</div>;
}
