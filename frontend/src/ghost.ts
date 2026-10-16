// A decorative copy of content that is leaving: it looks the same while it fades,
// but holds no live components, no form controls anyone can find by label or
// placeholder, no ids, links or roles, and no text of its own (CSS draws the words
// from data-ghost-text in reveal.css). Queries, find-in-page and assistive
// technology only ever see the content that is actually there. The copy is marked
// `data-ghost`, so its descendants do not replay their own entrances.

const STRIPPED = [
  "id",
  "for",
  "name",
  "role",
  "title",
  "href",
  "tabindex",
  "placeholder",
  "aria-label",
  "aria-labelledby",
  "aria-describedby",
  "aria-live",
  "aria-current",
  "aria-selected",
];

export function ghostCopy<T extends Element>(source: T): T {
  const copy = source.cloneNode(true) as T;
  // Cloning keeps attributes, not what someone typed or chose, so carry the shown values over.
  const live = source.querySelectorAll("input, select, textarea");
  copy.querySelectorAll("input, select, textarea").forEach((control, index) => {
    const shown = live[index];
    if (control instanceof HTMLInputElement && shown instanceof HTMLInputElement) {
      control.setAttribute("value", shown.value);
      control.toggleAttribute("checked", shown.checked);
    } else if (control instanceof HTMLTextAreaElement && shown instanceof HTMLTextAreaElement) {
      // The value, not text: a text node here would be found like any other text.
      control.textContent = "";
      control.value = shown.value;
    } else if (control instanceof HTMLSelectElement && shown instanceof HTMLSelectElement) {
      [...control.options].forEach((option, position) => {
        option.selected = !!shown.options[position]?.selected;
      });
    }
    control.setAttribute("disabled", "");
  });
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const name of STRIPPED) element.removeAttribute(name);
    for (const { name } of [...element.attributes])
      if (name.startsWith("aria-")) element.removeAttribute(name);
  }
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    // SVG text cannot hold HTML, and an option draws only its own text.
    if (
      text.data.trim() &&
      !(text.parentElement instanceof SVGElement) &&
      !(text.parentElement instanceof HTMLOptionElement)
    )
      texts.push(text);
  }
  for (const text of texts) {
    const drawn = document.createElement("span");
    drawn.dataset.ghostText = text.data;
    text.replaceWith(drawn);
  }
  copy.setAttribute("aria-hidden", "true");
  copy.setAttribute("data-ghost", "");
  return copy;
}

/** Calls `done` once the element's running animations finish, or at once when
 * none run; `cancelled` runs instead if one is cancelled. */
export function afterAnimations(element: Element, done: () => void, cancelled: () => void = done) {
  const running = element.getAnimations();
  if (!running.length) done();
  else Promise.all(running.map(animation => animation.finished)).then(done, cancelled);
}

/**
 * Plays a leaving copy of a dialog or popover that has already left the top
 * layer: the copy shows as an inert popover in its place, `mark` gives it the
 * class or attribute whose CSS animates the exit, and it removes itself when
 * that animation ends.
 */
export function playLeavingCopy(source: HTMLElement, mark: (copy: HTMLElement) => void) {
  const copy = ghostCopy(source);
  mark(copy);
  copy.inert = true;
  copy.popover = "manual";
  document.body.append(copy);
  const show = () => {
    if (!copy.isConnected) return;
    copy.showPopover();
    afterAnimations(copy, () => copy.remove());
  };
  try {
    show();
  } catch (error) {
    // An auto popover also hides when another one opens, and a popover cannot be
    // shown during that other show (a microtask still runs inside it): the copy
    // shows at the start of the next frame, before it is drawn.
    if (!(error instanceof DOMException && error.name === "InvalidStateError")) throw error;
    requestAnimationFrame(() => {
      try {
        show();
      } catch (retry) {
        copy.remove();
        throw retry;
      }
    });
  }
}
