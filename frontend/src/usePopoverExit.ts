import { useEffect, useRef } from "react";
import { ghostCopy } from "./ghost";
import { useInterfaceMotion } from "./MotionProvider";

/**
 * A native popover leaves the top layer the moment it hides, so it cannot play
 * an exit itself. When it hides, a detached copy fades out in its place
 * (`.popover-leaving` in reveal.css) and removes itself.
 */
export default function usePopoverExit<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const motion = useInterfaceMotion();
  useEffect(() => {
    const popover = ref.current;
    if (!popover || motion === "still") return;
    const leave = (event: Event) => {
      if ((event as ToggleEvent).newState !== "closed") return;
      const copy = ghostCopy(popover);
      copy.inert = true;
      copy.popover = "manual";
      copy.classList.add("popover-leaving");
      document.body.append(copy);
      copy.showPopover();
      const running = copy.getAnimations();
      const remove = () => copy.remove();
      if (!running.length) remove();
      else Promise.all(running.map(animation => animation.finished)).then(remove, remove);
    };
    popover.addEventListener("beforetoggle", leave);
    return () => popover.removeEventListener("beforetoggle", leave);
  });
  return ref;
}
