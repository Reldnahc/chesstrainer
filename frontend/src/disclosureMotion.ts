// Native <details> open and close instantly, and only some browsers can animate
// their content box. This animates every disclosure's height both ways in every
// browser: opening sets `open` and grows from the summary; closing shrinks to the
// summary and only then clears `open`. See docs/UI_COMPONENTS.md#motion.

import { duration, easing, motionAllowed } from "./motionTiming";

const running = new WeakMap<HTMLDetailsElement, Animation>();

function closedHeight(details: HTMLDetailsElement, summary: HTMLElement) {
  const style = getComputedStyle(details);
  return summary.offsetHeight + ["paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth"]
    .reduce((total, side) => total + (parseFloat(style[side as keyof CSSStyleDeclaration] as string) || 0), 0);
}

function toggle(details: HTMLDetailsElement, summary: HTMLElement) {
  const opening = !details.open || running.has(details) && details.dataset.animating === "closing";
  const start = details.getBoundingClientRect().height;
  running.get(details)?.cancel();
  details.open = true;
  const end = opening ? details.getBoundingClientRect().height : closedHeight(details, summary);
  details.dataset.animating = opening ? "opening" : "closing";
  const animation = details.animate(
    [{ height: `${start}px` }, { height: `${end}px` }],
    { duration: duration("--motion-base"), easing: easing("--ease-standard") },
  );
  running.set(details, animation);
  animation.onfinish = () => {
    running.delete(details);
    delete details.dataset.animating;
    if (!opening) details.open = false;
  };
  animation.oncancel = () => {
    if (running.get(details) === animation) running.delete(details);
  };
}

export function installDisclosureMotion() {
  document.addEventListener("click", event => {
    if (event.defaultPrevented || !(event.target instanceof Element)) return;
    const summary = event.target.closest("summary");
    const details = summary?.parentElement;
    if (!summary || !(details instanceof HTMLDetailsElement) || details.querySelector(":scope > summary") !== summary) return;
    // A control inside the summary does its own job instead of toggling.
    const control = event.target.closest("a, button, input, select, textarea, label");
    if (control && summary.contains(control)) return;
    if (!motionAllowed()) return;
    event.preventDefault();
    toggle(details, summary);
  });
}
