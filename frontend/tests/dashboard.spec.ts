import { expect, test, type Page } from "@playwright/test";
import type { Schema } from "../src/api";

type DashboardData = {
  due: Schema["ReviewCount"];
  games: Schema["GameHistory"];
  weaknesses: Schema["Weaknesses"];
  lessons: Schema["LessonLibrary"];
  openings: Schema["OpeningStudyLibrary"];
};
type Area = keyof DashboardData;
const endpoints: Record<Area, string> = {
  due: "/api/review/count", games: "/api/games", weaknesses: "/api/weaknesses",
  lessons: "/api/study/courses", openings: "/api/opening-studies",
};
const sections: Record<Area, string> = {
  due: "Due now", games: "Recent games", weaknesses: "Practice focus",
  lessons: "Keep learning", openings: "Keep learning",
};
const region = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

function skill(skill_id: string, title: string, overrides: Partial<Schema["SkillPriority"]> = {}): Schema["SkillPriority"] {
  return {
    skill_id, title, kind: "mechanism", cue: "Check forcing moves before deciding.",
    decision_ids: ["private-decision"], evidence_ids: ["private-evidence"],
    unique_positions: 3, independent_games: 2, reviews: 4, failures: 1, occurrences: 3,
    focused_attempts: 4, focused_failures: 1, lesson_attempts: 0, lesson_failures: 0,
    practice_positions: 3, priority: 1, provisional: false, retention: "needs_practice", ...overrides,
  };
}

function dashboardData(): DashboardData {
  const games: Schema["GameHistoryItem"][] = Array.from({ length: 4 }, (_, index) => ({
    id: `home-game-${index}`, white: "HomeLearner", black: `RecentOpponent${index}`,
    white_rating: 1200, black_rating: 1250, learner_color: "white", result: "1-0",
    status: index === 0 ? "completed" : "not_started", move_count: 32,
    played_on: "2026.09.26", played_at: "2026-09-26T16:00:00+00:00",
    time_control: "600", time_control_label: "10 min",
    accuracy: index === 0 ? { version: "lichess-2e653ad1-1", white: 82.125, black: 75.125 } : null,
  }));
  const courses: Schema["LessonCourseSummary"][] = [{
    id: "home-course", revision: "revision-1", title: "Build an opening plan",
    description: "Develop your pieces with a purpose.", learner_color: "white",
    chapter_count: 4, completed_chapters: 1,
  }];
  return {
    due: { due: 7 },
    games: { items: games, total: 12 },
    weaknesses: {
      classification_available: true, unclassified: 0,
      coverage: { total: 12, labeled: 12, mechanisms: 9, outcomes: 3, outcome_only: 3, pending: 0, unclassified: 0, abstention_reasons: {} },
      skills: [
        skill("material_loss", "Material loss", { kind: "outcome", priority: 100 }),
        skill("no_positions", "No active evidence", { practice_positions: 0 }),
        skill("fork", "Knight fork", { priority: 1, provisional: true, independent_games: 1 }),
        skill("pin", "Pinned defender", { priority: 9 }),
        skill("skewer", "Skewer", { priority: 2 }),
        skill("discovered_attack", "Discovered attack", { priority: 8 }),
      ],
    },
    lessons: {
      courses,
      resume: Array.from({ length: 3 }, (_, index) => ({
        id: `home-lesson-${index}`, chapter_id: `chapter-${index}`, chapter_title: `Saved chapter ${index + 1}`,
        course_id: courses[0].id, course_revision: courses[0].revision,
        course_title: `Saved lesson ${index + 1}`, updated_at: "2026-09-26T16:00:00+00:00",
      })),
    },
    openings: {
      active_studies: 3, due_positions: 2, learning_positions: 6,
      items: Array.from({ length: 3 }, (_, index) => ({
        id: `home-opening-${index}`, active: true, color: "white", due_positions: index === 0 ? 2 : 0,
        eco: "C50", name: `Opening line ${index + 1}`, positions: 2,
        source: "course_line", source_key: `line-${index}`, source_version: "revision-1",
      })),
    },
  };
}

async function mockDashboard(page: Page, data = dashboardData(), failures = new Set<Area>()) {
  const requests: { method: string; path: string; query: string }[] = [];
  const counts: Record<Area, number> = { due: 0, games: 0, weaknesses: 0, lessons: 0, openings: 0 };
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/api/")) requests.push({ method: request.method(), path: url.pathname, query: url.search });
  });
  await page.route("**/api/auth/me", route => route.fulfill({ json: { enabled: false, user: null } satisfies Schema["Identity"] }));
  await page.route("**/api/health", route => route.fulfill({ json: {
    classification_available: true, database: "ok", engine_available: false,
    engine_error: "Engine unavailable in this dashboard fixture", engine_status: "unavailable", engine_version: null,
  } satisfies Schema["Health"] }));
  await page.route("**/api/preferences/coach", route => route.fulfill({ json: { coach_id: "classic", motion: "still" } satisfies Schema["CoachPreferences"] }));
  await page.route("**/api/preferences/motion", route => route.fulfill({ json: { motion: "still" } satisfies Schema["MotionPreferences"] }));
  for (const area of Object.keys(endpoints) as Area[]) {
    await page.route(url => url.pathname === endpoints[area], route => {
      counts[area]++;
      return route.fulfill(failures.has(area)
        ? { status: 503, json: { detail: `${area} temporarily unavailable` } }
        : { json: data[area] });
    });
  }
  return { data, failures, requests, counts };
}

async function expectLoaded(page: Page, area: Area) {
  const section = region(page, sections[area]);
  if (area === "due") await expect(section.getByRole("link", { name: "Start studying", exact: true })).toHaveAttribute("href", "/study/due");
  if (area === "games") await expect(section.getByRole("link", { name: "Open review: HomeLearner vs RecentOpponent0", exact: true })).toBeVisible();
  if (area === "weaknesses") await expect(section.getByRole("link", { name: /^Knight fork / })).toBeVisible();
  if (area === "lessons") await expect(section.getByRole("link", { name: /^Saved lesson 1.*Saved chapter 1$/ })).toHaveAttribute("href", "/study/openings/sessions/home-lesson-0");
  if (area === "openings") {
    await expect(section.getByRole("term")).toHaveText(["Active opening lines"]);
    await expect(section.getByRole("definition")).toHaveText(["3"]);
  }
}

function expectReadOnly(requests: { method: string; path: string }[]) {
  expect(requests.filter(request => request.method !== "GET")).toEqual([]);
  expect(requests.filter(request => /\/(?:analyze|analysis|evidence|positions|puzzle-sessions|lesson-sessions)(?:\/|$)/.test(request.path)
    || (request.path.startsWith("/api/review/") && request.path !== "/api/review/count"))).toEqual([]);
}

test("Home presents bounded, actionable summaries without opening positions or starting analysis", async ({ page }, info) => {
  const fixture = await mockDashboard(page);
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page).toHaveTitle("Home · Fieldwork");
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
  for (const area of Object.keys(endpoints) as Area[]) await expectLoaded(page, area);
  await expect(region(page, "Due now").getByRole("term")).toHaveText(["Scheduled recalls"]);
  await expect(region(page, "Due now").getByRole("definition")).toHaveText(["7"]);
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation.getByRole("link")).toHaveText(["Home", "Study", "Games", "Weaknesses", "Settings"]);
  await expect(navigation.getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
  const recent = region(page, "Recent games");
  const history = recent.getByRole("region", { name: "Game history", exact: true });
  await expect(history.getByRole("link")).toHaveCount(4);
  await expect(history.getByRole("link").first()).toHaveAttribute("href", "/games/home-game-0");
  await expect(history.getByRole("link").first()).toHaveAccessibleDescription(/Accuracy: White 82\.1, Black 75\.1/);
  expect(fixture.requests.filter(request => request.path === "/api/games").map(request => Object.fromEntries(new URLSearchParams(request.query))))
    .toEqual([{ offset: "0", limit: "4" }]);
  const focus = region(page, "Practice focus");
  await expect(focus.locator('a[href^="/study/due?focus="]')).toHaveText([
    /Knight fork.*Early evidence/, /Pinned defender/, /Skewer/,
  ]);
  await expect(focus).toContainText(/early evidence/i);
  for (const id of ["fork", "pin", "skewer"]) await expect(focus.locator(`a[href="/study/due?focus=${id}"]`)).toBeVisible();
  for (const excluded of ["Material loss", "No active evidence", "Discovered attack"]) await expect(focus.getByText(excluded, { exact: true })).toHaveCount(0);
  const learning = region(page, "Keep learning");
  await expect(learning.locator('a[href^="/study/openings/sessions/"]')).toHaveCount(2);
  await expect(learning.getByText("Saved lesson 3", { exact: true })).toHaveCount(0);
  await expect(page.locator(".board-shell")).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Engine candidates", exact: true })).toHaveCount(0);
  for (const width of info.project.name === "mobile" ? [320, 390] : [768, 900, 1024, 1200, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const firstGame = history.getByRole("link").first();
    for (const selector of [".history-time", ".history-date", ".history-moves", ".history-accuracy", ".history-player"]) {
      for (const detail of await firstGame.locator(selector).all()) await expect(detail).toBeVisible();
    }
    if (width === 1200) {
      const players = (await firstGame.locator(".history-players").boundingBox())!;
      const details = (await firstGame.locator(".history-meta").boundingBox())!;
      expect(details.y).toBeGreaterThanOrEqual(players.y + players.height);
    }
    for (const link of await navigation.getByRole("link").all()) {
      await expect(link).toBeVisible();
      if (info.project.name === "mobile") expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
  }
  await page.screenshot({ path: `test-results/dashboard-${info.project.name}.png`, fullPage: true });
  expectReadOnly(fixture.requests);
});

test("Home and the brand preserve browser navigation while Study remains a separate destination", async ({ page }, info) => {
  await mockDashboard(page);
  await page.goto("/");
  await expectLoaded(page, "games");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Study", exact: true }).click();
  await expect(page).toHaveURL("/study");
  await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
  const brand = page.getByRole("link", { name: "Fieldwork home", exact: true, includeHidden: true });
  await expect(brand).toHaveAttribute("href", "/");
  const home = info.project.name === "mobile"
    ? page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Home", exact: true })
    : brand;
  await home.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/study");
  await page.goForward();
  await expect(page).toHaveURL("/");
  await page.reload();
  await expectLoaded(page, "games");
  await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Home", exact: true })).toHaveAttribute("aria-current", "page");
});

test("a new library offers useful destinations without suggesting an empty recall session", async ({ page }) => {
  const data = dashboardData();
  data.due = { due: 0 };
  data.games = { items: [], total: 0 };
  data.weaknesses.skills = [];
  data.lessons = { courses: [], resume: [] };
  data.openings = { items: [], active_studies: 0, due_positions: 0, learning_positions: 0 };
  const fixture = await mockDashboard(page, data);
  await page.goto("/");
  const due = region(page, "Due now");
  await expect(due.getByRole("link", { name: "Explore openings", exact: true })).toHaveAttribute("href", "/study/openings");
  await expect(due.getByRole("link", { name: "Start studying", exact: true })).toHaveCount(0);
  await expect(region(page, "Recent games")).toContainText(/import/i);
  await expect(region(page, "Recent games").locator('a[href="/settings"]')).toBeVisible();
  await expect(region(page, "Practice focus")).toContainText("No patterns ready to practice yet.");
  await expect(region(page, "Practice focus").locator('a[href^="/study/due?focus="]')).toHaveCount(0);
  await expect(region(page, "Keep learning")).toContainText("Choose an opening to study.");
  await expect(region(page, "Keep learning").getByRole("definition")).toHaveText(["0"]);
  await expect(region(page, "Keep learning").locator('a[href^="/study/openings/sessions/"]')).toHaveCount(0);
  await expect(page.getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expectReadOnly(fixture.requests);
});

test("an available course is offered when there is no saved lesson", async ({ page }) => {
  const data = dashboardData();
  data.lessons.resume = [];
  const fixture = await mockDashboard(page, data);
  await page.goto("/");
  const learning = region(page, "Keep learning");
  await expect(learning.getByRole("link", { name: /Build an opening plan/ })).toHaveAttribute("href", "/study/openings/courses/home-course?revision=revision-1");
  await expect(learning.locator('a[href^="/study/openings/sessions/"]')).toHaveCount(0);
  expectReadOnly(fixture.requests);
});

for (const failed of Object.keys(endpoints) as Area[]) {
  test(`${failed} can be retried without hiding or reloading the other Home summaries`, async ({ page }) => {
    const fixture = await mockDashboard(page, dashboardData(), new Set([failed]));
    await page.goto("/");
    const failedSection = region(page, sections[failed]);
    await expect(failedSection.getByRole("alert")).toBeVisible();
    for (const area of Object.keys(endpoints) as Area[]) if (area !== failed) await expectLoaded(page, area);
    expect(fixture.counts).toEqual({ due: 1, games: 1, weaknesses: 1, lessons: 1, openings: 1 });
    fixture.failures.delete(failed);
    await failedSection.getByRole("button", { name: /try again|retry/i }).click();
    await expectLoaded(page, failed);
    await expect(failedSection.getByRole("alert")).toHaveCount(0);
    expect(fixture.counts).toEqual({ due: 1, games: 1, weaknesses: 1, lessons: 1, openings: 1, [failed]: 2 });
    expectReadOnly(fixture.requests);
  });
}

test("leaving and returning to Home keeps newer data when an earlier summary finishes late", async ({ page }) => {
  const fixture = await mockDashboard(page);
  let release!: () => void;
  let started!: () => void;
  let settled!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const firstRequest = new Promise<void>(resolve => { started = resolve; });
  const firstHandled = new Promise<void>(resolve => { settled = resolve; });
  let attempts = 0;
  await page.route("**/api/weaknesses", async route => {
    const first = ++attempts === 1;
    if (first) { started(); await gate; }
    try {
      await route.fulfill({ json: { ...fixture.data.weaknesses, skills: [first
        ? skill("outdated", "Outdated practice")
        : skill("fresh", "Fresh practice")],
      } satisfies Schema["Weaknesses"] });
    } finally { if (first) settled(); }
  });
  try {
    await page.goto("/");
    await expect(region(page, "Practice focus").getByRole("status")).toContainText(/loading/i);
    for (const area of ["due", "games", "lessons", "openings"] as const) await expectLoaded(page, area);
    await firstRequest;
    const navigation = page.getByRole("navigation", { name: "Main navigation" });
    await navigation.getByRole("link", { name: "Study", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Study", exact: true })).toBeVisible();
    await navigation.getByRole("link", { name: "Home", exact: true }).click();
    const focus = region(page, "Practice focus");
    const fresh = focus.getByRole("link", { name: /^Fresh practice / });
    await expect(fresh).toHaveAttribute("href", "/study/due?focus=fresh");
    for (const area of ["due", "games", "lessons", "openings"] as const) await expectLoaded(page, area);
    release();
    await firstHandled;
    // Let any response-driven render finish before checking that new content survives.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await expect(fresh).toBeVisible();
    await expect(focus.getByRole("link", { name: /^Outdated practice / })).toHaveCount(0);
    await expect(focus.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(attempts).toBe(2);
    expectReadOnly(fixture.requests);
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
