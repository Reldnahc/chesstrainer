import { useEffect, useRef, useState, type ReactNode } from "react";
import { useInterfaceMotion } from "./MotionProvider";

const present = (children: ReactNode) =>
  children !== null && children !== undefined && children !== false && children !== "";

/**
 * Grows a conditional block open and collapses it closed instead of letting it
 * pop in or out: `<Reveal>{error && <Notice …/>}</Reveal>`. While closing, the
 * last content stays mounted and inert until its transition ends.
 */
export default function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const motion = useInterfaceMotion();
  const open = present(children);
  const last = useRef<ReactNode>(null);
  if (open) last.current = children;
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open || !mounted) return;
    // Reading the animations flushes the closed style, so the transition exists here.
    const running = motion === "still" ? [] : ref.current?.getAnimations() ?? [];
    let active = true;
    const finish = () => { if (active) { last.current = null; setMounted(false); } };
    if (!running.length) finish();
    else Promise.all(running.map(animation => animation.finished)).then(finish, () => {});
    return () => { active = false; };
  }, [open, mounted, motion]);
  if (!mounted) return null;
  return <div ref={ref} className={["reveal", className].filter(Boolean).join(" ")} data-open={open} inert={!open}>
    <div className="reveal-clip">{open ? children : last.current}</div>
  </div>;
}
