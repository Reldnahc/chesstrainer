// A decorative copy of content that is leaving: it looks the same while it fades,
// but holds no live components, no form controls anyone can find by label or
// placeholder, no ids, links or roles, and no text of its own (CSS draws the words
// from data-ghost-text in reveal.css). Queries, find-in-page and assistive
// technology only ever see the content that is actually there.

const STRIPPED = ["id", "for", "name", "role", "title", "href", "tabindex", "placeholder",
  "aria-label", "aria-labelledby", "aria-describedby", "aria-live", "aria-current", "aria-selected"];

export function ghostCopy<T extends Element>(source: T): T {
  const copy = source.cloneNode(true) as T;
  // Cloning keeps attributes, not what someone typed, so carry the shown values over.
  const live = source.querySelectorAll("input, select, textarea");
  copy.querySelectorAll("input, select, textarea").forEach((control, index) => {
    const value = (live[index] as HTMLInputElement | undefined)?.value ?? "";
    if (control instanceof HTMLInputElement) {
      control.setAttribute("value", value);
      if ((live[index] as HTMLInputElement).checked) control.setAttribute("checked", "");
    } else if (control instanceof HTMLTextAreaElement) control.textContent = "";
    control.setAttribute("disabled", "");
  });
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    for (const name of STRIPPED) element.removeAttribute(name);
    for (const { name } of [...element.attributes]) if (name.startsWith("aria-")) element.removeAttribute(name);
  }
  const walker = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode as Text;
    // SVG text cannot hold HTML; a label control's text was emptied above.
    if (text.data.trim() && !(text.parentElement instanceof SVGElement)) texts.push(text);
  }
  for (const text of texts) {
    const drawn = document.createElement("span");
    drawn.dataset.ghostText = text.data;
    text.replaceWith(drawn);
  }
  copy.setAttribute("aria-hidden", "true");
  return copy;
}
