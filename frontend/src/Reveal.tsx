import {
  Children,
  Fragment,
  isValidElement,
  useLayoutEffect,
  useReducer,
  useRef,
  type Key,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterAnimations, ghostCopy } from "./ghost";
import { useInterfaceMotion } from "./MotionProvider";

/*
 * Content that appears or disappears grows (or narrows) open and closed instead
 * of popping, the same way in every browser: each item sits in a one-track grid
 * whose track animates between 0fr and 1fr. A leaving item's live content
 * unmounts at once; a decorative copy of it (ghost.ts) stays, inert, until the
 * track has closed. See docs/UI_COMPONENTS.md#motion.
 */

type Phase = "entering" | "open" | "closing";
type Entry = { key: Key; node: ReactElement; phase: Phase; ghost?: HTMLElement };

const present = (children: ReactNode) =>
  children !== null && children !== undefined && children !== false && children !== "";

/** Merges the current keyed children with items still closing, in a stable order. */
function usePresence(
  children: ReactNode,
  {
    animateFirst,
    settled = true,
    exit = true,
  }: {
    animateFirst: boolean;
    settled?: boolean;
    exit?: boolean;
  },
) {
  const motion = useInterfaceMotion();
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  // The committed list; each render derives its own list from it and commits that
  // in the layout effect, so a render React discards changes nothing.
  const entries = useRef<Entry[]>([]);
  // Leaving items whose close has finished, dropped by the next render.
  const left = useRef(new Set<Key>());
  const arrivals = useRef(animateFirst);
  const elements = useRef(new Map<Key, HTMLDivElement>());
  /* eslint-disable react-hooks/refs -- each render derives its list from the
     committed one synchronously, so closing items keep their place and ghost in
     the same render that drops them; nothing here is committed until the effect. */
  const current = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const index = new Map<Key, number>(current.map((node, position) => [node.key!, position]));
  const previous = new Map(entries.current.map(entry => [entry.key, entry]));
  const animate = motion !== "still";
  const make = (node: ReactElement): Entry => {
    const before = previous.get(node.key!);
    const phase = !before
      ? arrivals.current && animate
        ? "entering"
        : "open"
      : before.phase === "closing"
        ? "open"
        : before.phase;
    return { key: node.key!, node, phase, ghost: undefined };
  };
  const merged: Entry[] = [];
  let next = 0;
  for (const entry of entries.current) {
    const position = index.get(entry.key);
    if (position === undefined) {
      // Leaving content is replaced by a decorative copy, so its live components
      // unmount now and nothing can find its controls or text while it fades.
      if (!animate || !exit || left.current.has(entry.key)) continue;
      const clip = elements.current.get(entry.key)?.firstElementChild;
      const ghost = entry.ghost ?? (clip instanceof HTMLElement ? ghostCopy(clip) : undefined);
      merged.push({ ...entry, phase: "closing", ghost });
      continue;
    }
    while (next <= position) merged.push(make(current[next++]));
  }
  while (next < current.length) merged.push(make(current[next++]));
  /* eslint-enable react-hooks/refs */

  // eslint-disable-next-line react-hooks/immutability -- marking an entered item open in the list just committed is what makes the next render keep it open
  useLayoutEffect(() => {
    entries.current = merged;
    if (settled) arrivals.current = true;
    for (const key of left.current)
      if (!merged.some(entry => entry.key === key && entry.phase === "closing"))
        left.current.delete(key);
    let opened = false;
    for (const entry of merged) {
      const element = elements.current.get(entry.key);
      if (!element) continue;
      if (entry.phase !== "open") collapseGap(element);
      else delete element.dataset.leaving;
      if (entry.phase === "entering") {
        // Commit the closed style first so the open style transitions from it.
        void element.offsetHeight;
        entry.phase = "open";
        opened = true;
      } else if (entry.phase === "closing" && !element.dataset.leaving) {
        element.dataset.leaving = "true";
        // A cancelled close means the item came back, so it stays.
        afterAnimations(
          element,
          () => {
            const latest = entries.current.find(item => item.key === entry.key);
            if (latest?.phase !== "closing") return;
            left.current.add(entry.key);
            refresh();
          },
          () => {},
        );
      }
    }
    if (opened) refresh();
  });

  const ref = (key: Key) => (element: HTMLDivElement | null) => {
    if (element) elements.current.set(key, element);
    else elements.current.delete(key);
  };
  return merged.map(entry => ({ ...entry, ref: ref(entry.key) }));
}

/**
 * A closed item still occupies its container's gap; a matching negative margin
 * lets that space close with it. Lone children have no gap to remove.
 */
function collapseGap(element: HTMLElement) {
  const parent = element.parentElement;
  let gap = 0;
  if (parent && parent.childElementCount > 1) {
    const style = getComputedStyle(parent);
    gap =
      parseFloat(
        style.display.includes("flex") && style.flexDirection.startsWith("row")
          ? style.columnGap
          : style.rowGap,
      ) || 0;
  }
  const value = `${gap}px`;
  if (element.style.getPropertyValue("--reveal-gap") !== value)
    element.style.setProperty("--reveal-gap", value);
}

function Item({
  entry,
  className,
  axis,
}: {
  entry: ReturnType<typeof usePresence>[number];
  className?: string;
  axis?: "block" | "inline";
}) {
  const { ref, phase, ghost, node } = entry;
  const open = phase === "open";
  return (
    <div
      ref={ref}
      className={["reveal", className].filter(Boolean).join(" ")}
      data-open={open}
      data-axis={axis}
      inert={phase === "closing" || undefined}
      aria-hidden={phase === "closing" || undefined}
    >
      {/* Distinct keys, so content that comes back mounts fresh beside no leftover copy. */}
      {ghost ? (
        <div
          key="ghost"
          className="reveal-clip"
          data-ghost=""
          ref={clip => {
            if (clip && !clip.firstChild) clip.append(...ghost.childNodes);
          }}
        />
      ) : (
        <div key="live" className="reveal-clip">
          {node}
        </div>
      )}
    </div>
  );
}

/** `<Reveal>{error && <Notice …/>}</Reveal>`: one conditional block grows in and collapses out. */
export default function Reveal({
  children,
  className,
  axis,
  exit = true,
}: {
  children: ReactNode;
  className?: string;
  /** `inline` grows from zero width, for a control appearing in a row. */
  axis?: "block" | "inline";
  /** false removes the content at once when it goes, e.g. a live region cleared to re-announce. */
  exit?: boolean;
}) {
  const entries = usePresence(
    present(children) ? <Fragment key="reveal">{children}</Fragment> : null,
    { animateFirst: true, exit },
  );
  return (
    <>
      {entries.map(entry => (
        <Item key={entry.key} entry={entry} className={className} axis={axis} />
      ))}
    </>
  );
}

/**
 * Keyed rows that grow in when added and collapse when removed. Rows present
 * when the list first settles (its data has loaded) appear with the page.
 */
export function RevealList({
  children,
  settled = true,
  className,
  exit = true,
}: {
  children: ReactNode;
  settled?: boolean;
  className?: string;
  /** false removes rows at once when they go. */
  exit?: boolean;
}) {
  const entries = usePresence(children, { animateFirst: false, settled, exit });
  return (
    <>
      {entries.map(entry => (
        <Item key={entry.key} entry={entry} className={className} />
      ))}
    </>
  );
}

/**
 * Swaps one keyed child for another in the same place: the old one closes while
 * the new one opens over it, so the size morphs and the content crossfades.
 * `inline` animates width for swaps inside a row of controls.
 */
export function Swap({
  children,
  axis = "block",
  className,
}: {
  children: ReactNode;
  axis?: "block" | "inline";
  className?: string;
}) {
  const entries = usePresence(children, { animateFirst: false });
  return (
    <div className={["reveal-swap", className].filter(Boolean).join(" ")}>
      {entries.map(entry => (
        <Item key={entry.key} entry={entry} axis={axis} />
      ))}
    </div>
  );
}
