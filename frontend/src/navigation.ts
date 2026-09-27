import { useEffect, useLayoutEffect, useRef, useState } from "react";

export const pagePaths = {
  Review: "/review",
  Games: "/games",
  Weaknesses: "/weaknesses",
  Import: "/import",
  Settings: "/settings",
} as const;
export type Tab = keyof typeof pagePaths;
const navigationEvent = "fieldwork:navigate";
const scrollKey = "fieldworkScroll";
const entryKey = "fieldworkEntry";
type ScrollPosition = { x: number; y: number };
const scrollPositions = new Map<string, ScrollPosition>();
// History identifiers are local bookkeeping, not security tokens. This also
// works on HTTP LAN installs, where crypto.randomUUID is unavailable.
const newEntry = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

function nonnegativeInteger(value: string | null, fallback = 0) {
  const number = Number(value);
  return value !== null && /^\d+$/.test(value) && Number.isSafeInteger(number) ? number : fallback;
}

function readRoute() {
  const url = new URL(window.location.href);
  // Keep old bookmarks working without adding an extra Back-button stop.
  if (url.pathname === "/") url.pathname = pagePaths.Review;
  if (url.searchParams.has("unit")) {
    url.searchParams.delete("unit");
    url.searchParams.delete("exercise");
  }
  const entry: string = window.history.state?.[entryKey] ?? newEntry();
  if (url.href !== window.location.href || !window.history.state?.[entryKey])
    window.history.replaceState({ ...window.history.state, [entryKey]: entry }, "", url);
  const path = url.pathname.replace(/\/$/, "");
  const gameMatch = path.match(/^\/games\/([^/]+)$/);
  let gameId: string | null = null;
  try { if (gameMatch) gameId = decodeURIComponent(gameMatch[1]); } catch { /* An invalid URL shows the not-found screen. */ }
  const tab = gameId ? "Games" : (Object.keys(pagePaths) as Tab[]).find(name => pagePaths[name] === path) ?? null;
  return {
    entry,
    coachStudio: path === "/coach-studio",
    href: url.pathname + url.search,
    tab,
    gameId,
    page: Math.max(1, Math.min(1_000_000, nonnegativeInteger(url.searchParams.get("page"), 1))),
    ply: nonnegativeInteger(url.searchParams.get("ply")),
    exercise: tab === "Review" ? url.searchParams.get("exercise") : null,
    focusSkill: tab === "Review" ? url.searchParams.get("focus") : null,
  };
}

function saveScroll(entry: string) {
  scrollPositions.set(entry, { x: window.scrollX, y: window.scrollY });
}

function persistScroll() {
  const entry = window.history.state?.[entryKey];
  if (!entry) return;
  saveScroll(entry);
  window.history.replaceState({ ...window.history.state, [scrollKey]: scrollPositions.get(entry) }, "");
}

export function navigate(href: string) {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || url.href === window.location.href) return;
  persistScroll();
  window.history.pushState({ [entryKey]: newEntry() }, "", url);
  window.dispatchEvent(new Event(navigationEvent));
}

export function gamesPath(page = 1, id?: string) {
  return `/games${id ? `/${encodeURIComponent(id)}` : ""}${page > 1 ? `?page=${page}` : ""}`;
}

// These annotate the current page, rather than navigating away from it. Keeping
// the mounted view avoids restarting a completed exercise or a game variation.
export function clearExerciseLink() {
  const url = new URL(window.location.href);
  url.searchParams.delete("exercise");
  url.searchParams.delete("unit");
  window.history.replaceState(window.history.state, "", url);
}

export function rememberGamePly(id: string, ply: number) {
  const url = new URL(window.location.href);
  if (url.pathname.replace(/\/$/, "") !== gamesPath(1, id)) return;
  if (ply) url.searchParams.set("ply", String(ply));
  else url.searchParams.delete("ply");
  window.history.replaceState(window.history.state, "", url);
}

export function useRoute() {
  const [location, setLocation] = useState(() => ({ route: readRoute(), scroll: (window.history.state?.[scrollKey] ?? null) as ScrollPosition | null }));
  const activeEntry = useRef(location.route.entry);
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const update = () => {
      saveScroll(activeEntry.current);
      const route = readRoute();
      activeEntry.current = route.entry;
      setLocation({ route, scroll: scrollPositions.get(route.entry) ?? window.history.state?.[scrollKey] ?? { x: 0, y: 0 } });
    };
    window.addEventListener("popstate", update);
    window.addEventListener(navigationEvent, update);
    window.addEventListener("pagehide", persistScroll);
    return () => {
      window.history.scrollRestoration = previous;
      window.removeEventListener("popstate", update);
      window.removeEventListener(navigationEvent, update);
      window.removeEventListener("pagehide", persistScroll);
    };
  }, []);
  useLayoutEffect(() => {
    let restoring = !!location.scroll;
    const target = location.scroll;
    // A returning library can still be loading. Retry as its content arrives,
    // but stop immediately if the user starts scrolling themselves.
    const observer = new ResizeObserver(restore);
    function stopRestoring() { restoring = false; observer.disconnect(); }
    function restore() {
      if (!restoring || !target) return;
      window.scrollTo({ left: target.x, top: target.y, behavior: "instant" });
      if (Math.abs(window.scrollY - target.y) < 1) stopRestoring();
    }
    if (target) {
      document.getElementById("main-content")?.focus({ preventScroll: true });
      observer.observe(document.body);
      restore();
    }
    window.addEventListener("wheel", stopRestoring, { passive: true });
    window.addEventListener("touchstart", stopRestoring, { passive: true });
    window.addEventListener("keydown", stopRestoring);
    return () => {
      observer.disconnect();
      window.removeEventListener("wheel", stopRestoring);
      window.removeEventListener("touchstart", stopRestoring);
      window.removeEventListener("keydown", stopRestoring);
    };
  }, [location]);
  return location.route;
}
