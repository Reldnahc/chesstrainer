// Native <details> open and close instantly, and only some browsers can animate
// their content box. This animates every disclosure's height both ways in every
// browser: opening sets `open` and grows from the summary; closing shrinks to the
// summary and only then clears `open`. See docs/UI_COMPONENTS.md#motion.

const running = new WeakMap<HTMLDetailsElement, Animation>();

function motionAllowed() {
  const choice = document.documentElement.dataset.interfaceMotion;
  if (choice) return choice === "natural";
  return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function token(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// The build may rewrite 250ms as .25s, so read either unit.
function milliseconds(time: string) {
  const value = parseFloat(time) || 0;
  return /\d\s*s$/.test(time) && !time.endsWith("ms") ? value * 1000 : value;
}

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
  const duration = milliseconds(token("--motion-base"));
  const animation = details.animate(
    [{ height: `${start}px` }, { height: `${end}px` }],
    { duration, easing: token("--ease-standard") || "ease-in-out" },
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
    if (event.target.closest("a, button, input, select, textarea, label") && event.target.closest("summary") === summary
      && event.target.closest("a, button, input, select, textarea, label") !== summary) return;
    if (!motionAllowed()) return;
    event.preventDefault();
    toggle(details, summary);
  });
}
