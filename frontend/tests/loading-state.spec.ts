import { expect, test, type Page, type Route } from "@playwright/test";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild, type ViteDevServer } from "vite";

// Exercise production consumers and their real requests without a database or
// engine. Deferred routes let the test observe the otherwise brief load state.
const harness = `
import React, { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import { LoadingState, UnavailableState } from "/src/LoadState.tsx";
import Button from "/src/Button.tsx";
import ActionLink from "/src/ActionLink.tsx";
import ReviewScreen from "/src/Review.tsx";
import GameWorkspace from "/src/gameReview/GameWorkspace.tsx";
import EvidenceDialog from "/src/EvidenceDialog.tsx";
import LessonPlayer from "/src/study/LessonPlayer.tsx";
import PuzzlePlayer from "/src/study/PuzzlePlayer.tsx";
import LessonLibrary from "/src/study/LessonLibrary.tsx";
import OpeningLinePreview from "/src/study/OpeningLinePreview.tsx";
import "/src/styles.css";

function Fixture() {
  const view = new URLSearchParams(location.search).get("view");
  const [evidence, setEvidence] = useState(false);
  const [error, setError] = useState("");
  const [attempts, setAttempts] = useState(0);
  const fail = useCallback(value => setError(String(value)), []);
  let contents;
  if (view === "lesson") contents = <LessonPlayer sessionId="loading-fixture" />;
  else if (view === "puzzle") contents = <PuzzlePlayer sessionId="loading-fixture" />;
  else if (view === "library") contents = <LessonLibrary courseId={null} revision={null} />;
  else if (view === "chapters") contents = <LessonLibrary courseId="loading-fixture" revision="fixture-v1" />;
  else if (view === "preview") contents = <OpeningLinePreview catalogueKey="loading-fixture" courseLine={null} />;
  else if (view === "course-preview") contents = <OpeningLinePreview catalogueKey={null} courseLine={{courseId: "loading-fixture", lineId: "line", revision: "fixture-v1"}} />;
  else if (view === "game") contents = <GameWorkspace id="loading-fixture" initialPly={0} libraryHref="/games?page=3" />;
  else if (view === "review") contents = <ReviewScreen requested={null} focusSkill={null} fail={fail} onEvidence={() => {}} />;
  else if (view === "evidence") contents = <><button onClick={() => setEvidence(true)}>Open evidence</button>{evidence && <EvidenceDialog id="loading-fixture" onClose={() => setEvidence(false)} fail={fail} />}</>;
  else contents = <>
    <div data-testid="compact"><LoadingState>Loading a small detail…</LoadingState></div>
    <div data-testid="panel"><LoadingState presentation="panel">Loading the full page…</LoadingState></div>
    <UnavailableState presentation="panel" heading={<h2>Caller-owned heading</h2>} actions={<>
      <Button onClick={() => setAttempts(value => value + 1)}>Retry caller operation</Button>
      <Button disabled onClick={() => setAttempts(value => value + 100)}>Unavailable command</Button>
      <ActionLink variant="secondary" href="/study/openings?from=loading-fixture">Browse opening lessons</ActionLink>
    </>}>The caller supplied this explanation.</UnavailableState>
    <span data-testid="attempts">{attempts}</span>
  </>;
  return <main style={{width: "100%", maxWidth: 900, padding: 16}}>{contents}<span data-testid="external-error">{error}</span></main>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
`;

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    plugins: [react(), {
      name: "loading-state-fixture",
      resolveId(id) {
        if (id === "/loading-state-fixture.tsx") return "\0loading-state-fixture.tsx";
      },
      async load(id) {
        if (id === "\0loading-state-fixture.tsx")
          return (await transformWithEsbuild(harness, "loading-state-fixture.tsx", { loader: "tsx", jsx: "automatic" })).code;
      },
      configureServer(vite) {
        vite.middlewares.use("/__loading-state", async (_request, response, next) => {
          try {
            const html = await vite.transformIndexHtml("/__loading-state", `<!doctype html>
              <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
              <body><div id="root"></div><script type="module" src="/loading-state-fixture.tsx"></script></body></html>`);
            response.setHeader("Content-Type", "text/html");
            response.end(html);
          } catch (error) {
            next(error);
          }
        });
      },
    }],
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  origin = server.resolvedUrls!.local[0];
});

test.afterAll(async () => {
  await server?.close();
});

test.beforeEach(async ({ page }, info) => {
  if (info.project.name === "mobile") await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
});

async function holdEndpoint(page: Page, endpoint: string) {
  const pending: Route[] = [];
  const methods: string[] = [];
  await page.route(`**${endpoint}`, route => {
    methods.push(route.request().method());
    pending.push(route);
  });
  return {
    methods,
    async reply(json: unknown, status = 200) {
      await expect.poll(() => pending.length).toBeGreaterThan(0);
      await pending.shift()!.fulfill({ status, json });
    },
  };
}

async function openFixture(page: Page, view: string) {
  await page.goto(`${origin}__loading-state?view=${view}`);
}

async function expectLoading(page: Page, message: string) {
  const status = page.getByRole("status").filter({ hasText: message });
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText(message);
  await expect(status).toHaveAttribute("aria-atomic", "true");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await expect(page.locator(".board-shell")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const fixture of [
  { view: "lesson", endpoint: "/api/study/lesson-sessions/loading-fixture", message: "Loading your lesson…", heading: "Lesson unavailable", link: "All openings", href: "/study/openings" },
  { view: "puzzle", endpoint: "/api/puzzle-sessions/loading-fixture", message: "Loading your puzzle…", heading: "Puzzle unavailable", link: "All puzzles", href: "/study/puzzles" },
]) {
  test(`${fixture.view} loading and retry preserve caller-owned recovery commands`, async ({ page }) => {
    const request = await holdEndpoint(page, fixture.endpoint);
    await openFixture(page, fixture.view);
    await expectLoading(page, fixture.message);
    await request.reply({ detail: "Saved session could not be loaded." }, 503);
    await expect(page.getByRole("heading", { name: fixture.heading, level: 1 })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveText("Saved session could not be loaded.");
    await expect(page.getByRole("status")).toHaveCount(0);
    const retry = page.getByRole("button", { name: "Try loading again", exact: true });
    const back = page.getByRole("link", { name: fixture.link, exact: true });
    await expect(retry).toHaveAttribute("type", "button");
    await expect(back).toHaveAttribute("href", fixture.href);
    await retry.focus();
    await page.keyboard.press("Enter");
    await expectLoading(page, fixture.message);
    await expect(retry).toHaveCount(0);
    await expect.poll(() => request.methods).toEqual(["GET", "GET"]);
    await request.reply({ detail: "The saved session is still unavailable." }, 503);
    await expect(page.getByRole("alert")).toHaveText("The saved session is still unavailable.");
    await expect(retry).toBeEnabled();
    await expect(back).toHaveAttribute("href", fixture.href);
    expect(request.methods).toEqual(["GET", "GET"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

for (const fixture of [
  { view: "game", endpoint: "/api/games/loading-fixture", message: "Opening game…", link: "All games", href: "/games?page=3" },
  { view: "library", endpoint: "/api/study/courses", message: "Loading opening lessons…" },
  { view: "chapters", endpoint: "/api/study/courses/loading-fixture?revision=fixture-v1", message: "Loading lesson chapters…", link: "All openings", href: "/study/openings" },
  { view: "preview", endpoint: "/api/openings/catalog/loading-fixture", message: "Loading the selected line…", link: "Back to openings", href: "/study/openings/catalogue" },
  { view: "course-preview", endpoint: "/api/openings/course-lines/loading-fixture/line?revision=fixture-v1", message: "Loading the selected line…", link: "Back to openings", href: "/study/openings/courses/loading-fixture?revision=fixture-v1" },
]) {
  test(`${fixture.view} switches its loading announcement to the caller error and retains navigation`, async ({ page }) => {
    const request = await holdEndpoint(page, fixture.endpoint);
    await page.route("**/api/opening-studies", route => route.fulfill({ json: { items: [] } }));
    await openFixture(page, fixture.view);
    await expectLoading(page, fixture.message);
    if (fixture.link) {
      const back = page.getByRole("link", { name: fixture.link, exact: true });
      await expect(back).toHaveAttribute("href", fixture.href!);
      await back.focus();
    }
    await request.reply({ detail: "The requested content could not be loaded." }, 503);
    await expect(page.getByRole("alert")).toHaveText("The requested content could not be loaded.");
    await expect(page.getByRole("status")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /retry|try loading again/i })).toHaveCount(0);
    if (fixture.link) {
      const back = page.getByRole("link", { name: fixture.link, exact: true });
      await expect(back).toHaveAttribute("href", fixture.href!);
      await expect(back).toBeFocused();
    }
    expect(request.methods).toEqual(["GET"]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test("practice announces its pending queue without exposing a position or answer controls", async ({ page }) => {
  await holdEndpoint(page, "/api/review/queue");
  await openFixture(page, "review");
  await expectLoading(page, "Loading your practice…");
  await expect(page.getByRole("heading", { name: "Your move.", level: 1 })).toBeVisible();
  await expect(page.getByRole("button", { name: /show|reveal|answer/i })).toHaveCount(0);
});

test("pending evidence has a compact announcement while its close action stays usable", async ({ page }) => {
  await holdEndpoint(page, "/api/evidence/loading-fixture");
  await openFixture(page, "evidence");
  const opener = page.getByRole("button", { name: "Open evidence", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Decision evidence" });
  await expectLoading(page, "Loading evidence…");
  await expect(dialog.getByRole("status")).toHaveText("Loading evidence…");
  const close = dialog.getByRole("button", { name: "Close evidence", exact: true });
  await expect(close).toBeEnabled();
  await close.click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("shared states keep announcements separate from supplied headings and action semantics", async ({ page }, info) => {
  await openFixture(page, "primitives");
  await expect(page.getByRole("status")).toHaveText(["Loading a small detail…", "Loading the full page…"]);
  await expect(page.getByRole("alert")).toHaveText("The caller supplied this explanation.");
  await expect(page.getByRole("heading", { name: "Caller-owned heading", level: 2 })).toBeVisible();
  await expect(page.getByRole("alert").getByRole("button")).toHaveCount(0);
  const retry = page.getByRole("button", { name: "Retry caller operation", exact: true });
  const disabled = page.getByRole("button", { name: "Unavailable command", exact: true });
  const link = page.getByRole("link", { name: "Browse opening lessons", exact: true });
  await expect(disabled).toBeDisabled();
  await expect(link).toHaveAttribute("href", "/study/openings?from=loading-fixture");
  await retry.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("attempts")).toHaveText("1");
  await page.keyboard.press("Tab");
  await expect(link).toBeFocused();
  const compact = (await page.getByTestId("compact").boundingBox())!;
  const panel = (await page.getByTestId("panel").boundingBox())!;
  expect(panel.height).toBeGreaterThan(compact.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const control of [retry, disabled, link]) {
    await expect(control).toBeInViewport({ ratio: 1 });
    if (info.project.name === "mobile") expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  await page.screenshot({ path: info.outputPath("loading-and-unavailable.png") });
});
