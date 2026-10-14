import {
  createContext, useContext, useEffect, useId, useLayoutEffect, useRef, useState,
  type ReactNode,
} from "react";
import Notice from "./Notice";
import { RevealList } from "./Reveal";
import "./toast.css";

/*
 * Every short-lived page message (an action's result, a confirmation, an error
 * after a command) is a toast: one region under the navigation that floats over
 * the page, so a message never pushes the content below it. Lasting state (a
 * game in progress, import history, a failing course file) stays an in-page
 * Notice. See docs/UI_COMPONENTS.md.
 */

/** Seconds a confirmation stays up. Errors and toasts with an action stay until closed. */
const CONFIRMATION_MS = 6000;

type Entry = {
  id: string;
  tone: "info" | "success" | "error";
  message: ReactNode;
  action?: ReactNode;
  onDismiss: () => void;
  persistent: boolean;
};

type Registry = {
  set: (entry: Entry) => void;
  remove: (id: string) => void;
};

const ToastContext = createContext<Registry | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const registry = useRef<Registry>({
    set: (entry) => setEntries((list) => list.some((item) => item.id === entry.id)
      ? list.map((item) => (item.id === entry.id ? entry : item))
      : [...list, entry]),
    remove: (id) => setEntries((list) => list.filter((item) => item.id !== id)),
  }).current;
  const region = useRef<HTMLDivElement>(null);
  // The header scrolls away on phones, so the region follows its bottom edge
  // until it reaches the top of the screen.
  useLayoutEffect(() => {
    let frame = 0;
    const place = () => {
      frame = 0;
      const header = document.querySelector(".app-header");
      const bottom = header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
      region.current?.style.setProperty("--toast-header-bottom", `${Math.round(bottom)}px`);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(place); };
    place();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <ToastContext.Provider value={registry}>
      {children}
      <div ref={region} className="toast-region" aria-label="Notifications" role="region">
        <RevealList>
          {entries.map((entry) => <ToastCard key={entry.id} entry={entry} />)}
        </RevealList>
      </div>
    </ToastContext.Provider>
  );
}

function ToastCard({ entry }: { entry: Entry }) {
  const [paused, setPaused] = useState(false);
  const dismiss = useRef(entry.onDismiss);
  dismiss.current = entry.onDismiss;
  useEffect(() => {
    if (entry.persistent || paused) return;
    const timer = window.setTimeout(() => dismiss.current(), CONFIRMATION_MS);
    return () => window.clearTimeout(timer);
  }, [entry.persistent, paused, entry.message]);
  return (
    <div className="toast" onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)} onBlur={() => setPaused(false)}>
      <Notice announcement={entry.tone === "error" ? "alert" : "status"} tone={entry.tone} appearance="toast"
        actions={entry.action} onDismiss={() => dismiss.current()}>
        {entry.message}
      </Notice>
    </div>
  );
}

/**
 * Shows its children as a toast while it is mounted: `{error && <Toast tone="error"
 * onDismiss={() => setError("")}>{error}</Toast>}`. The caller owns the message
 * state; closing (or a confirmation timing out) calls onDismiss.
 */
export default function Toast({ children, tone = "info", action, onDismiss, persistent }: {
  children: ReactNode;
  tone?: "info" | "success" | "error";
  /** One command or link, shown before the close button. */
  action?: ReactNode;
  onDismiss: () => void;
  /** Defaults to true for errors and toasts with an action; confirmations close themselves. */
  persistent?: boolean;
}) {
  const registry = useContext(ToastContext);
  const id = useId();
  useLayoutEffect(() => {
    registry?.set({ id, tone, message: children, action, onDismiss,
      persistent: persistent ?? (tone === "error" || !!action) });
  });
  useLayoutEffect(() => () => registry?.remove(id), [registry, id]);
  if (!registry) throw new Error("Toast needs a ToastProvider");
  return null;
}
