import {
  createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type ReactNode,
} from "react";
import Notice from "./Notice";
import { RevealList } from "./Reveal";
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
  const actions = useRef<Actions>({
    set: (entry) => setEntries((list) => list.some((item) => item.id === entry.id)
      ? list.map((item) => (item.id === entry.id ? entry : item))
      : [...list, entry]),
    remove: (id) => setEntries((list) => list.filter((item) => item.id !== id)),
  }).current;
  return (
    <BannerActions.Provider value={actions}>
      <BannerEntries.Provider value={entries}>{children}</BannerEntries.Provider>
    </BannerActions.Provider>
  );
}

/** The page's banner slot: the first block of the page, above its content. */
export function BannerOutlet() {
  const entries = useContext(BannerEntries);
  return (
    <div className="banner-region" aria-label="Notifications" role="region">
      <RevealList>
        {entries.map((entry) => <BannerCard key={entry.id} entry={entry} />)}
      </RevealList>
    </div>
  );
}

function BannerCard({ entry }: { entry: Entry }) {
  const [paused, setPaused] = useState(false);
  const dismiss = useRef(entry.onDismiss ?? (() => undefined));
  dismiss.current = entry.onDismiss ?? (() => undefined);
  useEffect(() => {
    if (entry.persistent || !entry.onDismiss || paused) return;
    const timer = window.setTimeout(() => dismiss.current(), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [entry.persistent, paused, entry.message]);
  return (
    <div onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <Notice announcement={entry.tone === "error" ? "alert" : "status"} tone={entry.tone} appearance="banner"
        actions={entry.action} onDismiss={entry.onDismiss && (() => dismiss.current())}>
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
export default function Banner({ children, tone = "info", action, onDismiss, persistent }: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
  /** One command or link, shown before the close button. */
  action?: ReactNode;
  /** Omitted for a banner that stays while its state lasts (a finished game's result); it then has no close button. */
  onDismiss?: () => void;
  /** Defaults to true for errors and banners with an action; confirmations close themselves. */
  persistent?: boolean;
}) {
  const actions = useContext(BannerActions);
  if (!actions) throw new Error("Banner needs a BannerProvider");
  const id = useId();
  useLayoutEffect(() => {
    actions.set({ id, tone, message: children, action, onDismiss,
      persistent: persistent ?? (tone === "error" || !!action) });
  });
  useLayoutEffect(() => () => actions.remove(id), [actions, id]);
  return null;
}
