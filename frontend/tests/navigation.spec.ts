import { test, expect, type Page } from "@playwright/test";
import { expectModifierClickLeftToBrowser } from "./modifierClick";

test.beforeEach(async ({ page }) => {
  // Navigation must work independently of Stockfish availability or analysis.
  await page.route("**/api/games/*/review", route =>
    route.fulfill({
      status: 503,
      json: { detail: "Review unavailable in this navigation fixture" },
    }),
  );
  await page.route("**/api/games/*/analyze", route =>
    route.fulfill({ json: { report: null, score: null, best_move: null } }),
  );
});

test("Back, Forward and refresh restore the game and move without a history entry per move", async ({
  page,
}, info) => {
  const { id } = await (
    await page.request.post(`/__test/game-review-fixture/history-${info.project.name}`)
  ).json();
  const documents: string[] = [];
  page.on("request", request => {
    if (request.isNavigationRequest()) documents.push(request.url());
  });
  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("heading", { name: "Home", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Games", exact: true }).click();
  await expect(page).toHaveURL("/games");
  const gameLink = page.getByRole("link", {
    name: new RegExp(`Review-history-${info.project.name} vs CoachFixture`),
  });
  await expect(gameLink).toHaveAttribute("href", `/games/${id}`);
  await gameLink.click();
  await expect(
    page.locator(".game-player-name", { hasText: `Review-history-${info.project.name}` }),
  ).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole("button", { name: "2. g4", exact: true }).click();
  await expect(page).toHaveURL(`/games/${id}?ply=3`);
  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(`/games/${id}?ply=2`);
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(page).toHaveURL(`/games/${id}?ply=4`);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  // The review's own shortcuts must leave browser navigation shortcuts alone.
  expect(
    await page.evaluate(() =>
      ["ArrowLeft", "ArrowRight"].map(key => {
        const event = new KeyboardEvent("keydown", {
          key,
          altKey: true,
          bubbles: true,
          cancelable: true,
        });
        document.body.dispatchEvent(event);
        return event.defaultPrevented;
      }),
    ),
  ).toEqual([false, false]);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await expect(page).toHaveURL("/settings");
  await expect(page).toHaveTitle("Settings · Fieldwork");
  await page.goBack();
  await expect(page).toHaveURL(`/games/${id}?ply=4`);
  await expect(page.getByRole("button", { name: "2… Qh4#", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await page.goBack();
  await expect(page).toHaveURL("/games");
  await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("button", { name: "2… Qh4#", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
  expect(documents).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole("button", { name: "2… Qh4#", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page).toHaveTitle(`Review-history-${info.project.name} vs CoachFixture · Fieldwork`);
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Games", exact: true })
    .click();
  await expect(page).toHaveURL("/games");
});

test("every screen has a bookmarkable link and clicking the active page adds no history", async ({
  page,
}) => {
  await page.goto("/import");
  await expect(page).toHaveURL("/settings");
  await expect(
    page
      .getByRole("navigation", { name: "Settings sections" })
      .getByRole("link", { name: "Games & imports", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("navigation").getByRole("link", { name: "Import", exact: true }),
  ).toHaveCount(0);
  for (const name of ["Home", "Study", "Games", "Insights", "Settings"]) {
    const path = name === "Home" ? "/" : `/${name.toLowerCase()}`;
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    const link = page.getByRole("navigation").getByRole("link", { name, exact: true });
    await expect(link).toHaveAttribute("href", path);
    await expect(link).toHaveAttribute("aria-current", "page");
    await expect(page.locator("main h1")).toBeVisible();
    const length = await page.evaluate(() => history.length);
    await link.click();
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page.reload();
    await expect(link).toHaveAttribute("aria-current", "page");
  }
  await page.getByRole("link", { name: "Games", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL("/games");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("an entry from before history entries were numbered is rewritten and counted as a step back", async ({
  page,
}) => {
  await page.goto("/play");
  // A tab open across the upgrade: the previous build wrote only an entry id, at an old address.
  await page.evaluate(() =>
    history.replaceState({ fieldworkEntry: "legacy-entry" }, "", "/weaknesses?category=outcomes"),
  );
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  await nav.getByRole("link", { name: "Study", exact: true }).click();
  await expect(page).toHaveURL("/study");
  await page.goBack();
  await expect(page).toHaveURL("/insights?section=outcomes");
  await expect(nav.getByRole("link", { name: "Insights", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  // Its new number places it before the Study entry, so Forward returns there.
  expect(await page.evaluate(() => history.state.fieldworkIndex)).toBe(0);
  await page.goForward();
  await expect(page).toHaveURL("/study");
});

test("without the Navigation API, a step onto an entry from before numbering is never given a guessed place", async ({
  page,
}) => {
  // Browsers without the Navigation API give no position in session history.
  await page.addInitScript(() =>
    Object.defineProperty(window, "navigation", { value: undefined, configurable: true }),
  );
  await page.goto("/play");
  // A tab reloaded on an earlier page after the upgrade: old-build entries lie on both sides of it.
  await page.evaluate(() => {
    history.replaceState({ fieldworkEntry: "legacy-before" }, "", "/play");
    history.pushState({ fieldworkEntry: "reloaded" }, "", "/study");
    history.pushState({ fieldworkEntry: "legacy-after" }, "", "/play");
  });
  await page.goBack();
  await expect(page).toHaveURL("/study");
  await page.reload();
  const place = () =>
    page.evaluate(() => ({
      run: history.state.fieldworkRun as string,
      index: history.state.fieldworkIndex as number,
    }));
  const start = await place();
  // Either side of the reloaded entry may hold an old entry, Forward as well as Back:
  // each starts a run of its own instead of taking a number beside the reloaded entry.
  for (const step of ["forward", "back"] as const) {
    await (step === "forward" ? page.goForward() : page.goBack());
    await expect(page).toHaveURL("/play");
    const landed = await place();
    expect(landed.run).not.toBe(start.run);
    await (step === "forward" ? page.goBack() : page.goForward());
    await expect(page).toHaveURL("/study");
    expect(await place()).toEqual(start);
  }
});

const noNavigationApi = (page: Page) =>
  page.addInitScript(() =>
    Object.defineProperty(window, "navigation", { value: undefined, configurable: true }),
  );

/** Reloads a fresh lesson editor whose neighbours are `before` and `after`, and types a draft. */
async function reloadedEditor(
  page: Page,
  before: Record<string, string> | null,
  after: Record<string, string> | null,
) {
  await page.goto("/play");
  await page.evaluate(
    ([before, after]) => {
      history.replaceState(before, "", before ? "/play" : "/play#top");
      history.pushState({ fieldworkEntry: "reloaded" }, "", "/settings/courses/editor");
      history.pushState(after, "", after ? "/study" : "/settings/courses/editor#later");
    },
    [before, after] as const,
  );
  await page.goBack();
  await expect(page).toHaveURL(/\/settings\/courses\/editor$/);
  await page.reload();
  await expect(page.getByRole("button", { name: "Save course" })).toBeVisible();
  const title = page.getByLabel("Title", { exact: true }).first();
  await title.fill("Unsaved draft");
  return title;
}

for (const step of ["back", "forward"] as const) {
  for (const neighbour of ["an old-build entry", "an unstamped entry"] as const) {
    test(`without the Navigation API, refusing ${step === "back" ? "Back" : "Forward"} after a reload onto ${neighbour} keeps the lesson editor and its draft`, async ({
      page,
    }) => {
      await noNavigationApi(page);
      const old = neighbour === "an old-build entry" ? { fieldworkEntry: "legacy" } : null;
      const title = await reloadedEditor(page, old, old);
      const prompts: string[] = [];
      page.on("dialog", async dialog => {
        prompts.push(dialog.message());
        // Stay the first time, then leave.
        if (prompts.length === 1) await dialog.dismiss();
        else await dialog.accept();
      });
      const go = () =>
        page.evaluate(
          direction => (direction === "back" ? history.back() : history.forward()),
          step,
        );
      await go();
      await expect.poll(() => prompts.length).toBe(1);
      // Which side the entry was on cannot be known, and refusing still keeps the editor, its draft and its address.
      await expect(page).toHaveURL(/\/settings\/courses\/editor$/);
      await expect(title).toHaveValue("Unsaved draft");
      // The editor came back as a new entry after the one the step reached; Back returns there and leaves.
      await page.evaluate(() => history.back());
      await expect.poll(() => prompts.length).toBe(2);
      await expect(page).not.toHaveURL(/\/settings\/courses\/editor$/);
    });
  }
}

test("without the Navigation API, refusing a step after a save puts the editor back at its saved address", async ({
  page,
}) => {
  await noNavigationApi(page);
  const title = await reloadedEditor(
    page,
    { fieldworkEntry: "legacy" },
    { fieldworkEntry: "legacy" },
  );
  await page.route("**/api/study/course-files*", route =>
    route.fulfill({
      json: {
        id: "saved-course",
        revision: "r2",
        revision_changed: false,
        title: "Unsaved draft",
      },
    }),
  );
  await page.getByRole("button", { name: "Save course" }).click();
  await expect(page).toHaveURL(/\/settings\/courses\/editor\?course=saved-course&revision=r2$/);
  await title.fill("Edited after saving");
  const asked = page.waitForEvent("dialog");
  await page.evaluate(() => history.back());
  await (await asked).dismiss();
  // The page comes back at the address it showed after the save, not the one it loaded at.
  await expect(page).toHaveURL(/\/settings\/courses\/editor\?course=saved-course&revision=r2$/);
  await expect(title).toHaveValue("Edited after saving");
});

test("game links support opening a second tab without navigating the first", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "desktop", "Modifier-click is a desktop interaction.");
  const { id } = await (await page.request.post("/__test/game-review-fixture/new-tab")).json();
  await page.goto("/games");
  await expectModifierClickLeftToBrowser(
    page,
    page.getByRole("link", { name: /Review-new-tab vs CoachFixture/ }),
    `/games/${id}`,
  );
  await expect(page).toHaveURL("/games");
  await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();
});

test("returning to the library restores its page and scroll after the list loads", async ({
  page,
}, info) => {
  const { id } = await (
    await page.request.post(`/__test/game-review-fixture/pagination-${info.project.name}`)
  ).json();
  await page.route("**/api/games?offset=*", async route => {
    const offset = Number(new URL(route.request().url()).searchParams.get("offset"));
    // Font swaps can change the header height and trigger native scroll anchoring.
    // Settle those metrics before this delayed list makes restoration possible.
    await page.evaluate(() => document.fonts.ready);
    return route.fulfill({
      json: {
        total: 60,
        items: Array.from({ length: offset < 60 ? 30 : 0 }, (_, index) => ({
          id: index === 20 ? id : `library-${offset + index}`,
          white: `Library ${offset + index}`,
          black: "Opponent",
          result: "0-1",
          played_on: "2026.09.26",
          status: "not_started",
        })),
      },
    });
  });
  await page.goto("/games");
  await page
    .getByRole("navigation", { name: "Games pages" })
    .getByRole("link", { name: "Next", exact: true })
    .click();
  await expect(page).toHaveURL("/games?page=2");
  const gameLink = page.getByRole("link", { name: /Library 50 vs Opponent/ });
  await gameLink.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  expect(scroll).toBeGreaterThan(500);
  await gameLink.click();
  await expect(page).toHaveURL(`/games/${id}?page=2`);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Games", exact: true }),
  ).toHaveAttribute("href", "/games?page=2");
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL("/games?page=2");
  await expect(gameLink).toBeVisible();
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - scroll))
    .toBeLessThan(2);
  const beforeReload = await page.evaluate(() => window.scrollY);
  await page.reload();
  await expect(gameLink).toBeVisible();
  await expect
    .poll(async () => Math.abs((await page.evaluate(() => window.scrollY)) - beforeReload))
    .toBeLessThan(2);
  await page.goBack();
  await expect(page).toHaveURL("/games");
  await expect(page.getByRole("navigation", { name: "Games pages" })).toContainText("1–30 of 60");
  await page.goto("/games?page=100");
  await expect(page.getByRole("heading", { name: "No games on this page." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Games pages" })).toHaveCount(0);
  await page.getByRole("link", { name: "Back to your games", exact: true }).click();
  await expect(page).toHaveURL("/games");
});

test("invalid game positions and missing pages give a usable return path", async ({
  page,
}, info) => {
  const { id } = await (
    await page.request.post(`/__test/game-review-fixture/invalid-link-${info.project.name}`)
  ).json();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`/games/${id}?ply=99999`);
  await expect(page.getByRole("button", { name: "2… Qh4#", exact: true })).toHaveAttribute(
    "aria-current",
    "step",
  );
  await expect(page).toHaveURL(`/games/${id}?ply=4`);
  await page.goto(`/games/${id}?ply=-1&page=invalid`);
  await expect(page.locator(".game-board-controls")).toContainText("0 / 4");
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Games", exact: true }),
  ).toHaveAttribute("href", "/games");
  await page.goto("/games/missing-game");
  await expect(page.getByRole("alert")).toContainText("Game not found");
  await page.getByRole("link", { name: "All games", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();
  for (const address of ["/not-a-page", "/games/%E0%A4%A"]) {
    await page.goto(address);
    await expect(page.getByRole("heading", { name: "Page not found", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Go to your games", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Your games" })).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("the lesson editor asks before Back or Forward leaves unsaved changes", async ({ page }) => {
  await page.goto("/settings?section=courses");
  await page.getByRole("link", { name: "New course" }).click();
  await expect(page).toHaveURL(/\/settings\/courses\/editor$/);
  const save = page.getByRole("button", { name: "Save course" });
  await expect(save).toBeVisible();
  const prompts: string[] = [];
  page.on("dialog", async dialog => {
    prompts.push(dialog.message());
    // Stay the first time, leave the second.
    if (prompts.length === 1) await dialog.dismiss();
    else await dialog.accept();
  });
  await page.evaluate(() => history.back());
  await expect.poll(() => prompts.length).toBe(1);
  // Refusing keeps the editor and its draft, and puts the address back.
  await expect(page).toHaveURL(/\/settings\/courses\/editor$/);
  await expect(save).toBeVisible();
  await page.evaluate(() => history.back());
  await expect(page).toHaveURL(/\/settings\?section=courses$/);
  expect(prompts).toEqual(
    Array(2).fill("Leave the lesson editor? Your unsaved changes will be lost."),
  );
  // Forward again into the editor needs no question: nothing there is unsaved yet.
  await page.evaluate(() => history.forward());
  await expect(page).toHaveURL(/\/settings\/courses\/editor$/);
  expect(prompts).toHaveLength(2);
});

test("a course that fails to load in the lesson editor offers Try again", async ({ page }) => {
  let asked = 0;
  await page.route("**/api/study/courses/demo/file*", route => {
    asked += 1;
    if (asked === 1)
      return route.fulfill({ status: 503, json: { detail: "Course files are unavailable." } });
    return route.fulfill({
      json: {
        format: "fieldwork-course-1",
        id: "demo",
        revision: "2026-10-15",
        title: "Demo course",
        side: "white",
        topic: "opening",
        credits: [],
        lines: [],
        chapters: [
          {
            id: "chapter-1",
            title: "Chapter 1",
            steps: [{ id: "introduction", title: "Introduction", text: "" }],
          },
        ],
      },
    });
  });
  await page.goto("/settings/courses/editor?course=demo");
  await expect(page.getByText("Couldn’t load the course.")).toBeVisible();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  // The opened course has nothing unsaved yet.
  await expect(page.getByRole("button", { name: "Saved", exact: true })).toBeVisible();
  expect(asked).toBe(2);
});
