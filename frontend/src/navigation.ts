import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

export const pagePaths = {
  Study: "/study",
  Games: "/games",
  Weaknesses: "/weaknesses",
  Settings: "/settings",
} as const;
export const studyPaths = {
  due: "/study/due",
  openings: "/study/openings",
  puzzles: "/study/puzzles",
} as const;
export type StudyMode = "home" | keyof typeof studyPaths;
export type Tab = keyof typeof pagePaths;
export type SettingsTab = "imports" | "coach" | "account" | "advanced";
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
  if (url.searchParams.has("unit")) {
    url.searchParams.delete("unit");
    url.searchParams.delete("exercise");
  }
  if (url.pathname === "/")
    url.pathname = url.searchParams.has("exercise") || url.searchParams.has("focus") || url.searchParams.has("session")
      ? studyPaths.due : pagePaths.Study;
  if (url.pathname.replace(/\/$/, "") === "/review") url.pathname = studyPaths.due;
  if (url.pathname.replace(/\/$/, "") === "/import") url.pathname = pagePaths.Settings;
  const entry: string = window.history.state?.[entryKey] ?? newEntry();
  if (url.href !== window.location.href || !window.history.state?.[entryKey])
    window.history.replaceState({ ...window.history.state, [entryKey]: entry }, "", url);
  const path = url.pathname.replace(/\/$/, "");
  const gameMatch = path.match(/^\/games\/([^/]+)$/);
  const puzzleMatch = path.match(/^\/study\/puzzles\/sessions\/([^/]+)$/);
  const lessonMatch = path.match(/^\/study\/openings\/sessions\/([^/]+)$/);
  const courseMatch = path.match(/^\/study\/openings\/courses\/([^/]+)$/);
  const catalogueMatch = path.match(/^\/study\/openings\/catalogue\/([^/]+)$/);
  const courseLineMatch = path.match(/^\/study\/openings\/courses\/([^/]+)\/lines\/([^/]+)$/);
  let gameId: string | null = null;
  let puzzleSessionId: string | null = null;
  let lessonSessionId: string | null = null;
  let lessonCourseId: string | null = null;
  let openingCatalogueKey: string | null = null;
  let openingCourseLine: { courseId: string; lineId: string; revision: string } | null = null;
  try { if (gameMatch) gameId = decodeURIComponent(gameMatch[1]); } catch { /* An invalid URL shows the not-found screen. */ }
  try { if (puzzleMatch) puzzleSessionId = decodeURIComponent(puzzleMatch[1]); } catch { /* An invalid URL shows the not-found screen. */ }
  try { if (lessonMatch) lessonSessionId = decodeURIComponent(lessonMatch[1]); } catch { /* An invalid URL shows the not-found screen. */ }
  try { if (courseMatch) lessonCourseId = decodeURIComponent(courseMatch[1]); } catch { /* An invalid URL shows the not-found screen. */ }
  try { if (catalogueMatch) openingCatalogueKey = decodeURIComponent(catalogueMatch[1]); } catch { /* Invalid source links show the not-found screen. */ }
  try { if (courseLineMatch) openingCourseLine = { courseId: decodeURIComponent(courseLineMatch[1]), lineId: decodeURIComponent(courseLineMatch[2]), revision: url.searchParams.get("revision") || "" }; } catch { /* Invalid source links show the not-found screen. */ }
  const openingSection: "catalogue" | "studies" | "lessons" = path === `${studyPaths.openings}/catalogue` || openingCatalogueKey ? "catalogue"
    : path === `${studyPaths.openings}/studies` ? "studies" : "lessons";
  const puzzleSource: "generic" | "games" | null = path === "/study/puzzles/generic" ? "generic"
    : path === "/study/puzzles/games" ? "games" : null;
  const studyMode: StudyMode | null = path === pagePaths.Study ? "home"
    : puzzleSessionId || puzzleSource ? "puzzles"
    : lessonSessionId || lessonCourseId || openingCatalogueKey || openingCourseLine || openingSection !== "lessons" ? "openings"
    : (Object.keys(studyPaths) as (keyof typeof studyPaths)[]).find(mode => studyPaths[mode] === path) ?? null;
  const tab: Tab | null = studyMode ? "Study" : gameId ? "Games"
    : (Object.keys(pagePaths) as Tab[]).find(name => pagePaths[name] === path) ?? null;
  const settingsSection = url.searchParams.get("section");
  return {
    entry,
    href: url.pathname + url.search,
    scrollAnchor: url.hash.slice(1),
    tab,
    settingsTab: (["coach", "account", "advanced"].includes(settingsSection ?? "") ? settingsSection : "imports") as SettingsTab,
    importSource: url.searchParams.get("import"),
    gameId,
    studyMode,
    puzzleSessionId,
    puzzleSource,
    lessonSessionId,
    lessonCourseId,
    lessonRevision: lessonCourseId ? url.searchParams.get("revision") : null,
    openingSection,
    openingCatalogueKey,
    openingCourseLine,
    openingQuery: url.searchParams.get("q") || "",
    openingEco: url.searchParams.get("eco") || "",
    openingOffset: nonnegativeInteger(url.searchParams.get("offset")),
    page: Math.max(1, Math.min(1_000_000, nonnegativeInteger(url.searchParams.get("page"), 1))),
    ply: nonnegativeInteger(url.searchParams.get("ply")),
    exercise: studyMode === "due" ? url.searchParams.get("exercise") : null,
    reviewSessionId: studyMode === "due" ? url.searchParams.get("session") : null,
    focusSkill: studyMode === "due" ? url.searchParams.get("focus") : null,
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

export function puzzleSessionPath(id: string) {
  return `${studyPaths.puzzles}/sessions/${encodeURIComponent(id)}`;
}

export function lessonSessionPath(id: string) {
  return `${studyPaths.openings}/sessions/${encodeURIComponent(id)}`;
}

export function lessonCoursePath(id: string, revision?: string) {
  return `${studyPaths.openings}/courses/${encodeURIComponent(id)}${revision ? `?revision=${encodeURIComponent(revision)}` : ""}`;
}

export function openingCataloguePath(key?: string) {
  return `${studyPaths.openings}/catalogue${key ? `/${encodeURIComponent(key)}` : ""}`;
}

export function courseLinePath(courseId: string, lineId: string, revision: string) {
  return `${studyPaths.openings}/courses/${encodeURIComponent(courseId)}/lines/${encodeURIComponent(lineId)}?revision=${encodeURIComponent(revision)}`;
}

export function rememberReviewSession(id: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("session", id);
  url.searchParams.delete("exercise");
  window.history.replaceState(window.history.state, "", url);
}

export function clearReviewSessionLink() {
  const url = new URL(window.location.href);
  url.searchParams.delete("session");
  window.history.replaceState(window.history.state, "", url);
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
  const [location, setLocation] = useState(() => ({
    route: readRoute(),
    scroll: (window.history.state?.[scrollKey] ?? null) as ScrollPosition | null,
    restoringScroll: !!window.history.state?.[scrollKey],
  }));
  const activeEntry = useRef(location.route.entry);
  useEffect(() => {
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    const update = () => {
      saveScroll(activeEntry.current);
      const route = readRoute();
      activeEntry.current = route.entry;
      const savedScroll = scrollPositions.get(route.entry) ?? window.history.state?.[scrollKey];
      setLocation({ route, scroll: savedScroll ?? { x: 0, y: 0 }, restoringScroll: !!savedScroll });
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
    const anchor = !location.restoringScroll ? location.route.scrollAnchor : "";
    let restoring = !!location.scroll || !!anchor;
    const target = location.scroll;
    // A returning library can still be loading. Retry as its content arrives,
    // but stop immediately if the user starts scrolling themselves.
    const observer = new ResizeObserver(restore);
    function stopRestoring() { restoring = false; observer.disconnect(); }
    function restore() {
      if (!restoring) return;
      if (anchor) {
        // A fresh deep link follows its section as asynchronous content loads.
        // History navigation instead restores the reader's saved position.
        document.getElementById(anchor)?.scrollIntoView();
        return;
      }
      if (!target) return;
      window.scrollTo({ left: target.x, top: target.y, behavior: "instant" });
      if (Math.abs(window.scrollY - target.y) < 1) stopRestoring();
    }
    if (target || anchor) {
      document.getElementById("main-content")?.focus({ preventScroll: true });
      observer.observe(document.body);
      restore();
    }
    window.addEventListener("wheel", stopRestoring, { passive: true });
    window.addEventListener("touchstart", stopRestoring, { passive: true });
    window.addEventListener("pointerdown", stopRestoring, { passive: true });
    window.addEventListener("keydown", stopRestoring);
    return () => {
      observer.disconnect();
      window.removeEventListener("wheel", stopRestoring);
      window.removeEventListener("touchstart", stopRestoring);
      window.removeEventListener("pointerdown", stopRestoring);
      window.removeEventListener("keydown", stopRestoring);
    };
  }, [location]);
  return useMemo(() => ({ ...location.route, restoringScroll: location.restoringScroll }), [location]);
}
