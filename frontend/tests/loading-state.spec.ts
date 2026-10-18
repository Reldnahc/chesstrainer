import { expect, test, type Page, type Route } from "./helpers/browserTest";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer, transformWithEsbuild, type ViteDevServer } from "vite";
import { devRecordingAssets } from "../vite.shared";
import { isolatedServer } from "./helpers/vite";

// Exercise production consumers and their real requests without a database or
// engine. Deferred routes let the test observe the otherwise brief load state.
const harness = `
import React from "react";
import { createRoot } from "react-dom/client";
import GameWorkspace from "/src/gameReview/GameWorkspace.tsx";
import LessonPlayer from "/src/study/LessonPlayer.tsx";
import "/src/styles.css";

function Fixture() {
  const view = new URLSearchParams(location.search).get("view");
  let contents = null;
  if (view === "lesson") contents = <LessonPlayer sessionId="loading-fixture" />;
  else if (view === "game") contents = <GameWorkspace id="loading-fixture" initialPly={0} libraryHref="/games?page=3" />;
  return <main style={{width: "100%", maxWidth: 900, padding: 16}}>{contents}</main>;
}
createRoot(document.getElementById("root")).render(<Fixture />);
`;

let server: ViteDevServer;
let origin: string;

test.beforeAll(async () => {
  server = await createServer({
    configFile: false,
    root: path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
    plugins: [
      react(),
      devRecordingAssets(),
      {
        name: "loading-state-fixture",
        resolveId(id) {
          if (id === "/loading-state-fixture.tsx") return "\0loading-state-fixture.tsx";
        },
        async load(id) {
          if (id === "\0loading-state-fixture.tsx")
            return (
              await transformWithEsbuild(harness, "loading-state-fixture.tsx", {
                loader: "tsx",
                jsx: "automatic",
              })
            ).code;
        },
        configureServer(vite) {
          // eslint-disable-next-line @typescript-eslint/no-misused-promises -- the handler catches every failure and passes it to next
          vite.middlewares.use("/__loading-state", async (_request, response, next) => {
            try {
              const html = await vite.transformIndexHtml(
                "/__loading-state",
                `<!doctype html>
              <html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
              <body><div id="root"></div><script type="module" src="/loading-state-fixture.tsx"></script></body></html>`,
              );
              response.setHeader("Content-Type", "text/html");
              response.end(html);
            } catch (error) {
              next(error);
            }
          });
        },
      },
    ],
    ...(await isolatedServer()),
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

// Lesson and puzzle players share the same retry component; the lesson stands in for both.
const retryFixture = {
  view: "lesson",
  endpoint: "/api/study/lesson-sessions/loading-fixture",
  message: "Loading your lesson…",
  failed: "Couldn’t load your lesson.",
  heading: "Lesson unavailable",
  link: "All lessons",
  href: "/study/openings",
};

test("lesson loading and retry preserve caller-owned recovery commands", async ({ page }) => {
  const fixture = retryFixture;
  const request = await holdEndpoint(page, fixture.endpoint);
  await openFixture(page, fixture.view);
  await expectLoading(page, fixture.message);
  await request.reply({ detail: "Saved session could not be loaded." }, 503);
  await expect(page.getByRole("heading", { name: fixture.heading, level: 1 })).toBeVisible();
  await expect(page.getByRole("alert")).toHaveText(
    `${fixture.failed} Saved session could not be loaded.`,
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  const retry = page.getByRole("button", { name: "Try again", exact: true });
  const back = page.getByRole("link", { name: fixture.link, exact: true });
  await expect(retry).toHaveAttribute("type", "button");
  await expect(back).toHaveAttribute("href", fixture.href);
  await retry.focus();
  await page.keyboard.press("Enter");
  await expectLoading(page, fixture.message);
  await expect(retry).toHaveCount(0);
  await expect.poll(() => request.methods).toEqual(["GET", "GET"]);
  await request.reply({ detail: "The saved session is still unavailable." }, 503);
  await expect(page.getByRole("alert")).toHaveText(
    `${fixture.failed} The saved session is still unavailable.`,
  );
  await expect(retry).toBeEnabled();
  await expect(back).toHaveAttribute("href", fixture.href);
  expect(request.methods).toEqual(["GET", "GET"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

// Every page passes props to the same shared load-state component; the game stands in for all.
const failureFixture = {
  view: "game",
  endpoint: "/api/games/loading-fixture",
  message: "Loading the game…",
  failed: "Couldn’t load the game. The requested content could not be loaded.",
  link: "All games",
  href: "/games?page=3",
};

test("game switches its loading announcement to the standard failure with Try again and retains navigation", async ({
  page,
}) => {
  const fixture = failureFixture;
  const request = await holdEndpoint(page, fixture.endpoint);
  await page.route("**/api/opening-studies", route => route.fulfill({ json: { items: [] } }));
  await openFixture(page, fixture.view);
  await expectLoading(page, fixture.message);
  const back = page.getByRole("link", { name: fixture.link, exact: true });
  await expect(back).toHaveAttribute("href", fixture.href);
  await back.focus();
  await request.reply({ detail: "The requested content could not be loaded." }, 503);
  await expect(page.getByRole("alert")).toHaveText(fixture.failed);
  await expect(page.getByRole("status")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(back).toHaveAttribute("href", fixture.href);
  await expect(back).toBeFocused();
  expect(request.methods).toEqual(["GET"]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
