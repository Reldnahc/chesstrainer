import { useEffect, useLayoutEffect, useSyncExternalStore } from "react";
import { localId } from "./localId";

export const pagePaths = {
  Home: "/",
  Study: "/study",
  Play: "/play",
  Games: "/games",
  Insights: "/insights",
  Settings: "/settings",
} as const;
export const studyPaths = {
  due: "/study/due",
  openings: "/study/openings",
  skills: "/study/skills",
  puzzles: "/study/puzzles",
} as const;
export type StudyMode = "home" | keyof typeof studyPaths;
export type LessonTopic = "opening" | "skills";
const lessonRoot = (topic: LessonTopic) => topic === "skills" ? studyPaths.skills : studyPaths.openings;
export type Tab = keyof typeof pagePaths;
/** Settings sections in their navigation order; the first is the plain /settings page. */
export const settingsSections = ["imports", "coach", "sound", "account", "courses", "advanced"] as const;
export type SettingsTab = (typeof settingsSections)[number];
export const insightsSections = ["overview", "patterns", "outcomes"] as const;
export type InsightsSection = (typeof insightsSections)[number];
export const openingSections = ["fundamentals", "lessons", "catalogue", "studies"] as const;
export type OpeningSection = (typeof openingSections)[number];
export const puzzleSources = ["generic", "games"] as const;
export type PuzzleSource = (typeof puzzleSources)[number];
type CourseLine = { courseId: string; lineId: string; revision: string; color: "white" | "black" };

// ---------------------------------------------------------------------------
// Destinations. Every in-app URL is built here, so parsing and building stay
// in step; screens never write paths or query strings by hand.

export function gamesPath(page = 1, id?: string) {
  return `/games${id ? `/${encodeURIComponent(id)}` : ""}${page > 1 ? `?page=${page}` : ""}`;
}

/** A game's review, optionally at a ply (the start needs no parameter) and returning to a library page. */
export function gameReviewPath(id: string, { page = 1, ply }: { page?: number; ply?: number | null } = {}) {
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (ply) query.set("ply", String(ply));
  const search = query.toString();
  return `/games/${encodeURIComponent(id)}${search ? `?${search}` : ""}`;
}

export function playGamePath(id: string) {
  return `/play/${encodeURIComponent(id)}`;
}

/** The Play setup, filled in with an earlier game's settings when one is given. */
export function playSetupPath(from?: string) {
  return from ? `${pagePaths.Play}?from=${encodeURIComponent(from)}` : pagePaths.Play;
}

export const insightsPaths: Record<InsightsSection, string> = {
  overview: "/insights",
  patterns: "/insights?section=patterns",
  outcomes: "/insights?section=outcomes",
};

/** A Settings section; Games & imports can open one import form, and any section can name an anchor. */
export function settingsPath(section: SettingsTab = "imports", options: { importSource?: string; anchor?: string } = {}) {
  const query = new URLSearchParams();
  if (section !== "imports") query.set("section", section);
  if (options.importSource) query.set("import", options.importSource);
  const search = query.toString();
  return `${pagePaths.Settings}${search ? `?${search}` : ""}${options.anchor ? `#${options.anchor}` : ""}`;
}
export const courseSettingsPath = settingsPath("courses");

/** Due, narrowed to the positions that practise one weakness. */
export function focusedPracticePath(skillId: string) {
  return `${studyPaths.due}?focus=${encodeURIComponent(skillId)}`;
}

export function puzzleSessionPath(id: string) {
  return `${studyPaths.puzzles}/sessions/${encodeURIComponent(id)}`;
}

/** The puzzle library, all sources or one. */
export function puzzleSourcePath(source?: PuzzleSource | null) {
  return source ? `${studyPaths.puzzles}/${source}` : studyPaths.puzzles;
}

export function lessonSessionPath(id: string, topic: LessonTopic = "opening") {
  return `${lessonRoot(topic)}/sessions/${encodeURIComponent(id)}`;
}

// The lesson editor belongs to administrators' Settings, not to Lessons.
const courseEditorRoot = "/settings/courses/editor";

/** The lesson editor, for a new course or an existing one. */
export function courseEditorPath(id?: string, revision?: string) {
  const query = new URLSearchParams();
  if (id) query.set("course", id);
  if (id && revision) query.set("revision", revision);
  const search = query.toString();
  return `${courseEditorRoot}${search ? `?${search}` : ""}`;
}

export function lessonCoursePath(id: string, revision?: string, topic: LessonTopic = "opening") {
  return `${lessonRoot(topic)}/courses/${encodeURIComponent(id)}${revision ? `?revision=${encodeURIComponent(revision)}` : ""}`;
}

/** The opening catalogue, a search within it, or one catalogue line. */
export function openingCataloguePath(key?: string, search: { query?: string; eco?: string; offset?: number } = {}) {
  if (key) return `${studyPaths.openings}/catalogue/${encodeURIComponent(key)}`;
  const params = new URLSearchParams();
  if (search.query) params.set("q", search.query);
  if (search.eco) params.set("eco", search.eco);
  if (search.offset) params.set("offset", String(search.offset));
  const query = params.toString();
  return `${studyPaths.openings}/catalogue${query ? `?${query}` : ""}`;
}

export const openingStudiesPath = `${studyPaths.openings}/studies`;

export function courseLinePath(courseId: string, lineId: string, revision: string, color: "white" | "black" = "white") {
  return `${studyPaths.openings}/courses/${encodeURIComponent(courseId)}/lines/${encodeURIComponent(lineId)}?revision=${encodeURIComponent(revision)}${color === "black" ? "&color=black" : ""}`;
}

// ---------------------------------------------------------------------------
// Parsing. A route names exactly one screen; App chooses the screen with an
// exhaustive switch over its kind, so a new screen cannot render beside another.

export type Screen =
  | { kind: "home" }
  | { kind: "due"; focusSkill: string | null; exercise: string | null; sessionId: string | null }
  | { kind: "study-home" }
  | { kind: "lessons"; section: OpeningSection; courseId: string | null; revision: string | null;
      query: string; eco: string; offset: number }
  | { kind: "puzzles"; source: PuzzleSource | null }
  | { kind: "puzzle-session"; id: string }
  | { kind: "lesson-session"; id: string }
  | { kind: "line-preview"; catalogueKey: string | null; courseLine: CourseLine | null }
  | { kind: "course-editor"; courseId: string | null; revision: string | null }
  | { kind: "play"; gameId: string | null; from: string | null }
  | { kind: "games"; page: number; gameId: string | null; ply: number }
  | { kind: "insights"; section: InsightsSection }
  | { kind: "settings"; section: SettingsTab; importSource: string | null }
  | { kind: "not-found" };

export type Route = {
  /** This history entry's identity, for scroll restoration. */
  entry: string;
  href: string;
  scrollAnchor: string;
  tab: Tab | null;
  screen: Screen;
  /** A history step back to a position that is being restored. */
  restoringScroll: boolean;
};

function nonnegativeInteger(value: string | null, fallback = 0) {
  const number = Number(value);
  return value !== null && /^\d+$/.test(value) && Number.isSafeInteger(number) ? number : fallback;
}

const decoded = (value: string) => {
  try { return decodeURIComponent(value); } catch { return null; }
};
const oneOf = <T extends string>(values: readonly T[], value: string | null): T | null =>
  values.includes(value as T) ? (value as T) : null;

/** Old and moved addresses, rewritten to today's (without adding a Back-button stop). */
export function canonicalUrl(href: string): URL {
  const url = new URL(href);
  const path = () => url.pathname.replace(/\/$/, "");
  if (url.searchParams.has("unit")) {
    url.searchParams.delete("unit");
    url.searchParams.delete("exercise");
    if (url.pathname === "/" && !url.searchParams.has("focus") && !url.searchParams.has("session")) url.pathname = pagePaths.Study;
  }
  if (url.pathname === "/" && (url.searchParams.has("exercise") || url.searchParams.has("focus") || url.searchParams.has("session")))
    url.pathname = studyPaths.due;
  if (path() === "/review") url.pathname = studyPaths.due;
  if (path() === "/import") url.pathname = pagePaths.Settings;
  // Weaknesses became sections of Insights; library insights briefly lived under Games.
  if (path() === "/weaknesses") {
    const category = url.searchParams.get("category");
    url.searchParams.delete("category");
    url.searchParams.set("section", category === "outcomes" ? "outcomes" : "patterns");
    url.pathname = pagePaths.Insights;
  }
  if (path() === "/games/insights") url.pathname = pagePaths.Insights;
  return url;
}

/** The screen an address shows. Pure: it reads the URL and nothing else. */
export function parseScreen(url: URL): Screen {
  const path = url.pathname.replace(/\/$/, "") || "/";
  const query = url.searchParams;
  const match = (pattern: RegExp) => path.match(pattern);
  let found: RegExpMatchArray | null;
  if (path === pagePaths.Home) return { kind: "home" };
  if (path === studyPaths.due)
    return { kind: "due", focusSkill: query.get("focus"), exercise: query.get("exercise"), sessionId: query.get("session") };
  if (path === pagePaths.Study) return { kind: "study-home" };
  if ((found = match(/^\/study\/puzzles\/sessions\/([^/]+)$/))) {
    const id = decoded(found[1]);
    return id ? { kind: "puzzle-session", id } : { kind: "not-found" };
  }
  if (path === studyPaths.puzzles) return { kind: "puzzles", source: null };
  if ((found = match(/^\/study\/puzzles\/([^/]+)$/))) {
    const source = oneOf(puzzleSources, found[1]);
    return source ? { kind: "puzzles", source } : { kind: "not-found" };
  }
  if ((found = match(/^\/study\/(openings|skills)\/sessions\/([^/]+)$/))) {
    const id = decoded(found[2]);
    return id ? { kind: "lesson-session", id } : { kind: "not-found" };
  }
  if ((found = match(/^\/study\/openings\/catalogue\/([^/]+)$/))) {
    const catalogueKey = decoded(found[1]);
    return catalogueKey ? { kind: "line-preview", catalogueKey, courseLine: null } : { kind: "not-found" };
  }
  if ((found = match(/^\/study\/openings\/courses\/([^/]+)\/lines\/([^/]+)$/))) {
    const courseId = decoded(found[1]), lineId = decoded(found[2]);
    if (!courseId || !lineId) return { kind: "not-found" };
    return { kind: "line-preview", catalogueKey: null, courseLine: { courseId, lineId,
      revision: query.get("revision") || "", color: query.get("color") === "black" ? "black" : "white" } };
  }
  const lessons = (section: OpeningSection, courseId: string | null = null): Screen => ({
    kind: "lessons", section, courseId, revision: courseId ? query.get("revision") : null,
    query: query.get("q") || "", eco: query.get("eco") || "", offset: nonnegativeInteger(query.get("offset")),
  });
  if ((found = match(/^\/study\/(openings|skills)\/courses\/([^/]+)$/))) {
    const courseId = decoded(found[2]);
    return courseId ? lessons(found[1] === "skills" ? "fundamentals" : "lessons", courseId) : { kind: "not-found" };
  }
  // The Study Lessons section holds the opening and fundamentals courses beside the
  // opening catalogue and studies; skills courses keep their own URLs.
  if (path === studyPaths.openings) return lessons("lessons");
  if (path === studyPaths.skills) return lessons("fundamentals");
  if (path === `${studyPaths.openings}/catalogue`) return lessons("catalogue");
  if (path === openingStudiesPath) return lessons("studies");
  if (path === courseEditorRoot) {
    const courseId = query.get("course");
    return { kind: "course-editor", courseId, revision: courseId ? query.get("revision") : null };
  }
  if (path === pagePaths.Play) return { kind: "play", gameId: null, from: query.get("from") };
  if ((found = match(/^\/play\/([^/]+)$/))) {
    const gameId = decoded(found[1]);
    return gameId ? { kind: "play", gameId, from: null } : { kind: "not-found" };
  }
  const page = Math.max(1, Math.min(1_000_000, nonnegativeInteger(query.get("page"), 1)));
  if (path === pagePaths.Games) return { kind: "games", page, gameId: null, ply: 0 };
  if ((found = match(/^\/games\/([^/]+)$/))) {
    const gameId = decoded(found[1]);
    return gameId ? { kind: "games", page, gameId, ply: nonnegativeInteger(query.get("ply")) } : { kind: "not-found" };
  }
  if (path === pagePaths.Insights)
    return { kind: "insights", section: oneOf(insightsSections, query.get("section")) ?? "overview" };
  if (path === pagePaths.Settings)
    return { kind: "settings", section: oneOf(settingsSections, query.get("section")) ?? "imports", importSource: query.get("import") };
  return { kind: "not-found" };
}

/** The main navigation tab each screen belongs to. */
export function screenTab(screen: Screen): Tab | null {
  switch (screen.kind) {
    case "home": return "Home";
    case "due": case "study-home": case "lessons": case "puzzles": case "puzzle-session":
    case "lesson-session": case "line-preview": return "Study";
    case "course-editor": case "settings": return "Settings";
    case "play": return "Play";
    case "games": return "Games";
    case "insights": return "Insights";
    case "not-found": return null;
  }
}

// ---------------------------------------------------------------------------
// History. One store owns the listeners, whatever renders the route, and every
// entry this app writes carries its identity and its position in the session.

const navigationEvent = "fieldwork:navigate";
const scrollKey = "fieldworkScroll";
const entryKey = "fieldworkEntry";
const indexKey = "fieldworkIndex";
type ScrollPosition = { x: number; y: number };
type Location = { route: Route; scroll: ScrollPosition | null };
const scrollPositions = new Map<string, ScrollPosition>();


const historyState = (): Record<string, unknown> => (window.history.state ?? {}) as Record<string, unknown>;
const entryIndex = (state: unknown): number | null => {
  const value = (state as Record<string, unknown> | null)?.[indexKey];
  return typeof value === "number" ? value : null;
};

function readLocation(scroll: ScrollPosition | null, restoringScroll: boolean): Location {
  const url = new URL(window.location.href);
  const screen = parseScreen(url);
  return {
    route: {
      entry: String(historyState()[entryKey] ?? ""),
      href: url.pathname + url.search,
      scrollAnchor: url.hash.slice(1),
      tab: screenTab(screen),
      screen,
      restoringScroll,
    },
    scroll,
  };
}
// A reload or a return from another site restores the position saved with the entry.
function initialLocation(): Location {
  const saved = (historyState()[scrollKey] ?? null) as ScrollPosition | null;
  return readLocation(saved, !!saved);
}

let location: Location | null = null;
let currentIndex = 0;
let ignoredPop = false;
const listeners = new Set<() => void>();

/** Rewrites an old address and gives the current entry its identity. Runs once,
 * before the first render, so reading the route never writes history. */
export function startRouter() {
  const url = canonicalUrl(window.location.href);
  const state = historyState();
  currentIndex = entryIndex(state) ?? 0;
  if (url.href !== window.location.href || !state[entryKey] || entryIndex(state) === null)
    window.history.replaceState({ ...state, [entryKey]: state[entryKey] ?? localId(), [indexKey]: currentIndex }, "", url);
  location = initialLocation();
}

function saveScroll(entry: string) {
  scrollPositions.set(entry, { x: window.scrollX, y: window.scrollY });
}

function persistScroll() {
  const entry = historyState()[entryKey];
  if (typeof entry !== "string") return;
  saveScroll(entry);
  window.history.replaceState({ ...historyState(), [scrollKey]: scrollPositions.get(entry) }, "");
}

function update() {
  if (location) saveScroll(location.route.entry);
  const entry = String(historyState()[entryKey] ?? "");
  const saved = scrollPositions.get(entry) ?? (historyState()[scrollKey] as ScrollPosition | undefined);
  // A step to an entry with no saved position starts at the top.
  location = readLocation(saved ?? { x: 0, y: 0 }, !!saved);
  listeners.forEach((listener) => listener());
}

function popped(event: PopStateEvent) {
  if (ignoredPop) {
    ignoredPop = false;
    return;
  }
  let next = entryIndex(event.state);
  // An in-page #fragment link adds an entry the app did not write; it follows the current one.
  if (next === null) {
    next = currentIndex + 1;
    window.history.replaceState({ ...historyState(), [entryKey]: localId(), [indexKey]: next }, "");
  }
  // Back or Forward out of a screen with unsaved work asks first, as a link does.
  // Refusing returns to the entry the reader was on, and that return is not a navigation.
  if (leaveGuard && next !== currentIndex && !leaveGuard()) {
    ignoredPop = true;
    window.history.go(currentIndex - next);
    return;
  }
  currentIndex = next;
  update();
}

function subscribe(listener: () => void) {
  if (!location) startRouter();
  listeners.add(listener);
  if (listeners.size === 1) {
    window.history.scrollRestoration = "manual";
    window.addEventListener("popstate", popped);
    window.addEventListener(navigationEvent, update);
    window.addEventListener("pagehide", persistScroll);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size) return;
    window.history.scrollRestoration = "auto";
    window.removeEventListener("popstate", popped);
    window.removeEventListener(navigationEvent, update);
    window.removeEventListener("pagehide", persistScroll);
  };
}

function snapshot(): Location {
  return location ?? (location = initialLocation());
}

// A screen with unsaved work (the lesson editor) asks before any navigation leaves it.
let leaveGuard: (() => boolean) | null = null;

/** While `active`, leaving by a link, Back, Forward, reload or closing the tab asks first. */
export function useLeaveGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active) return;
    const guard = () => window.confirm(message);
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    leaveGuard = guard;
    window.addEventListener("beforeunload", warn);
    return () => {
      if (leaveGuard === guard) leaveGuard = null;
      window.removeEventListener("beforeunload", warn);
    };
  }, [active, message]);
}

export function navigate(href: string) {
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin || url.href === window.location.href) return;
  if (leaveGuard && !leaveGuard()) return;
  persistScroll();
  currentIndex += 1;
  window.history.pushState({ [entryKey]: localId(), [indexKey]: currentIndex }, "", url);
  window.dispatchEvent(new Event(navigationEvent));
}

// These annotate the current page, rather than navigating away from it. Keeping
// the mounted view avoids restarting a completed exercise or a game variation.
function annotate(change: (url: URL) => void) {
  const url = new URL(window.location.href);
  change(url);
  window.history.replaceState(window.history.state, "", url);
}

export const rememberReviewSession = (id: string) => annotate((url) => {
  url.searchParams.set("session", id);
  url.searchParams.delete("exercise");
});
export const clearReviewSessionLink = () => annotate((url) => url.searchParams.delete("session"));
export const clearExerciseLink = () => annotate((url) => {
  url.searchParams.delete("exercise");
  url.searchParams.delete("unit");
});
/** Keeps a game's review address on the ply being read, so a reload returns there. */
export const rememberGamePly = (id: string, ply: number) => annotate((url) => {
  if (url.pathname.replace(/\/$/, "") !== gamesPath(1, id)) return;
  if (ply) url.searchParams.set("ply", String(ply));
  else url.searchParams.delete("ply");
});
/** Replaces the current address without a navigation (a new course's first save). */
export const replaceAddress = (href: string) => annotate((url) => {
  const next = new URL(href, url);
  url.pathname = next.pathname;
  url.search = next.search;
  url.hash = next.hash;
});

/** The current route. Every caller reads the same store; only one set of listeners exists. */
export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot).route;
}

// How long the page must stay still before a deep link stops following its anchor.
const ANCHOR_SETTLE_MS = 1000;

/** Restores the reader's position after a history step, or follows a fresh link's
 * #anchor while the page's content loads. App runs it once, after the screen renders. */
export function useScrollRestoration() {
  const current = useSyncExternalStore(subscribe, snapshot);
  useLayoutEffect(() => {
    const anchor = !current.route.restoringScroll ? current.route.scrollAnchor : "";
    let restoring = !!current.scroll || !!anchor;
    let settle = 0;
    const target = current.scroll;
    // A returning library can still be loading. Retry as its content arrives,
    // but stop immediately if the user starts scrolling themselves.
    const observer = new ResizeObserver(restore);
    function stopRestoring() {
      restoring = false;
      observer.disconnect();
      window.clearTimeout(settle);
    }
    function restore() {
      if (!restoring) return;
      if (anchor) {
        // A fresh deep link follows its section while asynchronous content loads,
        // and lets go once the page has been still for a moment.
        const element = document.getElementById(anchor);
        element?.scrollIntoView();
        window.clearTimeout(settle);
        if (element) settle = window.setTimeout(stopRestoring, ANCHOR_SETTLE_MS);
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
      stopRestoring();
      window.removeEventListener("wheel", stopRestoring);
      window.removeEventListener("touchstart", stopRestoring);
      window.removeEventListener("pointerdown", stopRestoring);
      window.removeEventListener("keydown", stopRestoring);
    };
  }, [current]);
}
