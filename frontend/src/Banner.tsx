import {
  createContext, isValidElement, useContext, useEffect, useEffectEvent, useId, useLayoutEffect, useRef, useState,
  type ReactNode,
} from "react";
import Notice from "./Notice";
import { RevealList } from "./Reveal";
import { useLatest } from "./useLatest";
import "./banner.css";

/*
 * Every short-lived page message (an action's result, a confirmation, an error
 * after a command) is a banner in one slot at the top of the page, so every
 * page shows them in the same place with the same compact look. Lasting state
 * (a game in progress, import history, a failing course file) stays an
 * in-page Notice where it belongs. See docs/UI_COMPONENTS.md.
 */

/** How long a confirmation stays up. Errors and banners with an action stay until closed. */
const CONFIRMATION_MS = 6000;

type Entry = {
  id: string;
  /** Changes when the message does, restarting a confirmation's timer. */
  revision: number;
  tone: "info" | "success" | "error";
  message: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  persistent: boolean;
};

type Actions = {
  set: (entry: Entry) => void;
  remove: (id: string) => void;
};

const BannerActions = createContext<Actions | null>(null);
const BannerEntries = createContext<Entry[]>([]);

export function BannerProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [actions] = useState<Actions>(() => ({
    set: (entry) => setEntries((list) => list.some((item) => item.id === entry.id)
      ? list.map((item) => (item.id === entry.id ? entry : item))
      : [...list, entry]),
    remove: (id) => setEntries((list) => list.filter((item) => item.id !== id)),
  }));
  return (
    <BannerActions.Provider value={actions}>
      <BannerEntries.Provider value={entries}>{children}</BannerEntries.Provider>
    </BannerActions.Provider>
  );
}

/** The page's banner slot: the first block of the page, above its content.
 * `page` names the page shown. */
export function BannerOutlet({ page }: { page: string }) {
  const entries = useContext(BannerEntries);
  return (
    <div className="banner-region" aria-label="Notifications" role="region">
      <PageBanners key={page} entries={entries} />
    </div>
  );
}

/** Banners still up from the previous page go at once when their page's
 * components unmount, rather than collapsing above the next page while it
 * restores its scroll position. Banners this page raises open and close. */
function PageBanners({ entries }: { entries: Entry[] }) {
  const [inherited] = useState(() => new Set(entries.map((entry) => entry.id)));
  const card = (entry: Entry) => <BannerCard key={entry.id} entry={entry} />;
  return (
    <>
      <RevealList exit={false}>{entries.filter((entry) => inherited.has(entry.id)).map(card)}</RevealList>
      <RevealList>{entries.filter((entry) => !inherited.has(entry.id)).map(card)}</RevealList>
    </>
  );
}

function BannerCard({ entry }: { entry: Entry }) {
  const [paused, setPaused] = useState(false);
  const dismissible = !!entry.onDismiss;
  const expire = useEffectEvent(() => entry.onDismiss?.());
  useEffect(() => {
    if (entry.persistent || !dismissible || paused) return;
    const timer = window.setTimeout(expire, CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [entry.persistent, dismissible, paused, entry.revision]);
  return (
    <div onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <Notice announcement={entry.tone === "error" ? "alert" : "status"} tone={entry.tone} appearance="banner"
        actions={entry.action} onDismiss={entry.onDismiss}>
        {entry.message}
      </Notice>
    </div>
  );
}

/**
 * Shows its children in the page's banner slot while it is mounted:
 * `{error && <Banner tone="error" onDismiss={() => setError("")}>{error}</Banner>}`.
 * The caller owns the message state; closing (or a confirmation timing out)
 * calls onDismiss.
 */
export default function Banner({ children, tone = "info", action, onDismiss }: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
  /** One command or link, shown before the close button. */
  action?: ReactNode;
  /** Omitted for a banner that stays while its state lasts (a finished game's result); it then has no close button. */
  onDismiss?: () => void;
}) {
  const actions = useContext(BannerActions);
  if (!actions) throw new Error("Banner needs a BannerProvider");
  const id = useId();
  const dismiss = useLatest(onDismiss);
  // Republish only when what the banner shows changes, not on every owner render.
  const published = useRef<{ tone: string; children: ReactNode; action: ReactNode; dismissible: boolean;
    revision: number } | null>(null);
  useLayoutEffect(() => {
    const last = published.current;
    const sameMessage = !!last && last.tone === tone && sameContent(last.children, children);
    if (sameMessage && sameContent(last.action, action) && last.dismissible === !!onDismiss) return;
    const revision = sameMessage ? last.revision : (last?.revision ?? 0) + 1;
    published.current = { tone, children, action, dismissible: !!onDismiss, revision };
    actions.set({ id, revision, tone, message: children, action,
      onDismiss: onDismiss && (() => dismiss.current?.()),
      // Errors and banners with an action stay until closed; confirmations close themselves.
      persistent: tone === "error" || !!action });
  });
  useLayoutEffect(() => () => {
    published.current = null;
    actions.remove(id);
  }, [actions, id]);
  return null;
}

/** Whether two renders' content shows the same thing: equal values, or elements
 * of the same type and key whose props are the same. Callbacks compare by
 * identity, so an action with a fresh handler is republished (but its timer,
 * which follows the message, keeps running). */
function sameContent(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((item, index) => sameContent(item, b[index]));
  if (!isValidElement(a) || !isValidElement(b) || a.type !== b.type || a.key !== b.key) return false;
  const left = a.props as Record<string, unknown>, right = b.props as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => sameContent(left[key], right[key]));
}
