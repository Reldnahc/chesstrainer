import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useInterfaceMotion } from "./MotionProvider";

/**
 * `<DialogPresence>{open && <SomeDialog …/>}</DialogPresence>`: when the owner
 * dismisses a modal, it stays mounted and inert while its closing animation plays
 * (`dialog[data-closing]` in reveal.css), then unmounts so useModalDialog closes
 * it and restores focus. Without that stylesheet or with motion off it closes at once.
 */
export default function DialogPresence({ children }: { children: ReactNode }) {
  const motion = useInterfaceMotion();
  const open = children !== null && children !== undefined && children !== false;
  const last = useRef<ReactNode>(null);
  if (open) last.current = children;
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const dialog = ref.current?.querySelector("dialog");
    if (open) {
      if (dialog) { delete dialog.dataset.closing; dialog.inert = false; }
      return;
    }
    if (!mounted) return;
    const finish = () => { last.current = null; setMounted(false); };
    if (motion === "still" || !dialog?.open) return finish();
    dialog.dataset.closing = "true";
    dialog.inert = true;
    const running = dialog.getAnimations();
    if (!running.length) return finish();
    let active = true;
    Promise.all(running.map(animation => animation.finished)).then(() => { if (active) finish(); }, () => {});
    return () => { active = false; };
  }, [open, mounted, motion]);
  if (!mounted) return null;
  // The wrapper never boxes: the dialog renders in the top layer.
  return <div ref={ref} style={{ display: "contents" }}>{open ? children : last.current}</div>;
}
