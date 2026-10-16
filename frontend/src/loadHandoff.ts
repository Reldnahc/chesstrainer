// When a LoadingState (or UnavailableState) is replaced by the content it was
// waiting for, the loader fades out where it stood during the first half and the
// content fades in during the second, so their text never overlaps, on every page
// and in every browser, without each screen wiring up its own transition. Layout
// settles at once: screens scroll and measure right after loading, so the content
// does not grow in. See docs/UI_COMPONENTS.md#motion.
import { ghostCopy } from "./ghost";
import { duration, easing, motionAllowed } from "./motionTiming";

const LOADER = ".load-state";
/** The loader stays visible a moment longer as a fading copy over the new content. */
function fadeOut(loader: Element, at: DOMRect) {
  const copy = ghostCopy(loader as HTMLElement);
  Object.assign(copy.style, {
    position: "fixed",
    top: `${at.top}px`,
    left: `${at.left}px`,
    width: `${at.width}px`,
    margin: "0",
    pointerEvents: "none",
    zIndex: "1",
    animation: "none",
  });
  document.body.append(copy);
  const fade = copy.animate([{ opacity: 1 }, { opacity: 0 }], {
    duration: duration("--motion-base") / 2,
    easing: easing("--ease-standard"),
    fill: "forwards",
  });
  fade.finished.then(
    () => copy.remove(),
    () => copy.remove(),
  );
}

// Content stays transparent while the loader fades, then fades in.
const fadeIn = [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 1 }];

function handOff(records: MutationRecord[]) {
  const removed = new Map<Node, Element[]>();
  const added = new Map<Node, HTMLElement[]>();
  for (const record of records) {
    record.addedNodes.forEach(node => {
      if (node instanceof HTMLElement && !node.matches(LOADER))
        added.set(record.target, [...(added.get(record.target) ?? []), node]);
    });
    record.removedNodes.forEach(node => {
      if (node instanceof Element && node.matches(LOADER))
        removed.set(record.target, [...(removed.get(record.target) ?? []), node]);
    });
  }
  if (!removed.size || !motionAllowed()) return;
  for (const [parent, loaders] of removed) {
    const content = (added.get(parent) ?? []).filter(element => element.isConnected);
    const loader = loaders[0];
    const anchor = content[0]?.getBoundingClientRect();
    if (anchor) fadeOut(loader, anchor);
    for (const element of content)
      element.animate(fadeIn, {
        duration: duration("--motion-base"),
        easing: easing("--ease-standard"),
      });
  }
}

export function installLoadHandoff(root: Element) {
  new MutationObserver(handOff).observe(root, { childList: true, subtree: true });
}
