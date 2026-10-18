import { test, expect, type Locator, type Page } from "./helpers/browserTest";

// Mobile review scrolls naturally; compare document geometry across feedback,
// independently of the scrolling needed to tap an action beneath the board.
const documentBox = (locator: Locator) =>
  locator.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect();
    return { x: x + scrollX, y: y + scrollY, width, height };
  });

// Imports only save games; each game's own analysis job reports here when it finishes.
const completedAnalyses = async (page: Page): Promise<number> =>
  (await (await page.request.get("/api/analysis/queue")).json()).completed;

test("redesigned screens fit the viewport and load local fonts and favicon", async ({
  page,
}, testInfo) => {
  await page.goto("/study/due");
  await expect(page.getByRole("heading", { name: "Your move." })).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('14px "IBM Plex Sans"'))).toBe(true);
  const icon = await page.locator('link[rel="icon"]').getAttribute("href");
  const response = await page.request.get(icon!);
  expect(response.headers()["content-type"]).toContain("image/svg+xml");
  expect(await response.text()).toContain("<svg");
  for (const tab of ["Home", "Study", "Games", "Insights", "Settings"]) {
    await page.getByRole("link", { name: tab, exact: true }).click();
    await expect(page.getByRole("link", { name: tab, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.locator("main h1")).toBeVisible();
    if (tab === "Settings") {
      await expect(
        page.getByRole("region", { name: "Recent Chess.com games", exact: true }),
      ).toBeVisible();
      await page
        .getByRole("navigation", { name: "Settings sections" })
        .getByRole("link", { name: "Advanced", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Training tools", exact: true }),
      ).toBeVisible();
      const source = page.getByRole("link", { name: "Source code on GitHub" });
      await expect(source).toHaveAttribute("href", "https://github.com/Reldnahc/chesstrainer");
      await expect(source).toHaveAttribute("target", "_blank");
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/redesign-${testInfo.project.name}-${tab.toLowerCase()}.png`,
      fullPage: true,
    });
  }
});

test("create a curated position, fail once, solve by tapping and retain after reload", async ({
  page,
}, testInfo) => {
  await page.goto("/study/due");
  await expect(page.getByRole("heading", { name: "Your move." })).toBeVisible();
  const savedPosition = await page.request.post("/api/exercises/manual", {
    data: {
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      moves: [testInfo.project.name === "mobile" ? "d2d4" : "e2e4"],
    },
  });
  expect(savedPosition.ok()).toBe(true);
  const exerciseId = (await savedPosition.json()).id;
  await page.goto(`/?exercise=${exerciseId}`);
  await expect(page.getByRole("heading", { name: "Find a good move." })).toBeVisible();
  await expect(page.getByText("Also accepted:", { exact: false })).not.toBeVisible();
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-review.png`,
    fullPage: true,
  });
  const board = page.locator(".board-shell");
  const square = (name: string) => board.locator(`[data-square="${name}"]`);
  const markers = board.locator("[data-legal-destination]");
  await square("e2").click();
  await expect(square("e2").locator(".board-square-content")).toHaveCSS(
    "background-color",
    "rgb(233, 165, 105)",
  );
  await expect(markers).toHaveCount(2);
  await expect(board.locator('[data-legal-destination="e4"]')).toBeVisible();
  await square("e2").click();
  await expect(markers).toHaveCount(0);
  await square("e2").click();
  await square("d2").click();
  await expect(board.locator('[data-legal-destination="d4"]')).toBeVisible();
  await expect(board.locator('[data-legal-destination="e4"]')).toHaveCount(0);
  await square("d5").click();
  await expect(markers).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Reveal move" })).toBeVisible();
  await square("g1").click();
  await square("f3").click();
  await expect(page.locator(".move-status.retry")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reveal move" })).toBeVisible();
  // The coach's feedback is one live region in every state; its line adds none of its own.
  const liveRegions = page
    .locator(".review-coach")
    .locator('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"]');
  await expect(liveRegions).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Find a good move." })).toBeVisible();
  await expect(liveRegions).toHaveCount(1);
  // The same region stays in place as the feedback changes, so each change is announced.
  await page.locator(".review-coach .move-status").evaluate(element => {
    element.dataset.probe = "kept";
  });
  const file = testInfo.project.name === "mobile" ? "d" : "e";
  await square(`${file}2`).click();
  await square(`${file}4`).click();
  await expect(
    page.getByRole("status").filter({ hasText: "This recall stays marked for relearning." }),
  ).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Progress saved." })).toContainText(
    "Next review:",
  );
  await expect(liveRegions).toHaveCount(1);
  await expect(page.locator('.review-coach [data-probe="kept"]')).toContainText(`${file}4`);
  expect(new URL(page.url()).searchParams.has("exercise")).toBe(false);
  const nextQueue = page.waitForResponse(r => r.url().includes("/api/review/queue"));
  await page.reload();
  expect(
    (await (await nextQueue).json()).map((item: { exercise_id: string }) => item.exercise_id),
  ).not.toContain(exerciseId);
  await expect(
    page.getByRole("status").filter({ hasText: "This recall stays marked for relearning." }),
  ).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("PGN upload form imports a learner game and reports real analysis", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await page.getByRole("button", { name: "Paste PGN text", exact: true }).click();
  await page
    .getByLabel("PGN", { exact: true })
    .fill(
      `[Round "${testInfo.project.name}"]\n[White "UI learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1`,
    );
  await page.getByLabel("Your username(s)").fill("UI learner");
  const analyzed = await completedAnalyses(page);
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect(page.locator(".import-form").getByRole("status")).toContainText(/imported/);
  // Every imported game gets its own review and training job in the background.
  await expect.poll(() => completedAnalyses(page), { timeout: 30000 }).toBeGreaterThan(analyzed);
  const previousJobs = await page.locator(".job").count();
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect(page.locator(".import-form").getByRole("status")).toContainText("0 imported");
  await expect(page.locator(".import-form").getByRole("status")).toContainText("1 duplicate");
  await expect(page.locator(".job")).toHaveCount(previousJobs);
});

test("Chess.com username import fetches, analyzes and deduplicates without OpenAI", async ({
  page,
}, testInfo) => {
  const username = `ui-import-${testInfo.project.name}`;
  await page.goto("/");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page
    .getByRole("region", { name: "Recent Chess.com games", exact: true })
    .getByRole("button", { name: "Import older games", exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Import from Chess.com" })).toBeVisible();
  await expect(page.getByLabel("Time control", { exact: true })).toHaveValue("rapid");
  await expect(page.getByLabel("Look back")).toHaveValue("3");
  await expect(page.getByLabel("Maximum new games")).toHaveValue("100");
  await page.getByLabel("Chess.com username", { exact: true }).fill(username);
  await page.getByLabel("Look back").selectOption("6");
  await page.getByLabel("Maximum new games").fill("25");
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = endDate.slice(0, 7) + "-01";
  await page.getByText("Custom date range", { exact: true }).click();
  await page.getByLabel("From date").fill(startDate);
  await page.getByLabel("To date").fill(endDate);
  await expect(page.getByLabel("Look back")).toBeDisabled();
  const queued = page.waitForResponse(
    r => r.url().endsWith("/api/imports/provider/chesscom") && r.request().method() === "POST",
  );
  const analyzed = await completedAnalyses(page);
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  const response = await queued;
  expect(response.status()).toBe(202);
  expect(response.request().postDataJSON()).toEqual({
    username,
    time_class: "rapid",
    months: 6,
    max_games: 25,
    start_date: startDate,
    end_date: endDate,
  });
  await expect(
    page.getByRole("region", { name: "Notifications" }).getByRole("status"),
  ).toContainText("Import queued");
  const job = page.locator(".job").filter({ hasText: username }).first();
  await expect(job.locator(".badge")).toHaveText("completed", { timeout: 30000 });
  await expect(job).toContainText("1 imported");
  await expect.poll(() => completedAnalyses(page), { timeout: 30000 }).toBeGreaterThan(analyzed);
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-chesscom-import.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect(job).toContainText("0 imported · 1 duplicate", { timeout: 30000 });
  await expect(job.locator(".badge")).toHaveText("completed", { timeout: 30000 });
  // A fetch job only saves games, so it has no analysis progress of its own.
  await expect(job.getByRole("progressbar", { name: "Analysis progress" })).toHaveCount(0);
  await expect(job).toContainText("No new games found");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test("Chess.com missing username reports a retryable provider error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page
    .getByRole("region", { name: "Recent Chess.com games", exact: true })
    .getByRole("button", { name: "Import older games", exact: true })
    .click();
  await page.getByLabel("Chess.com username", { exact: true }).fill("missing-player");
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  const job = page.locator(".job").filter({ hasText: "missing-player" }).first();
  await expect(job.locator(".badge")).toHaveText("failed", { timeout: 10000 });
  await job.locator("summary").first().click();
  await expect(job).toContainText("not found");
  await expect(job.getByRole("button", { name: "Retry saved work" })).toBeVisible();
});

test("phone reviews keep a full-width board and reachable actions through retries and details", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Phone viewport regression");
  for (const size of [
    { width: 390, height: 700 },
    { width: 375, height: 600 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(size);
    const response = await page.request.post("/api/exercises/manual", {
      data: {
        fen: "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1",
        moves: ["e2e4"],
        explanation: "A detailed explanation. ".repeat(60),
      },
    });
    const { id } = await response.json();
    await page.goto(`/?exercise=${id}`);
    const board = page.locator(".board-shell");
    const square = (name: string) => board.locator(`[data-square="${name}"]`);
    const fits = async (action: string) => {
      const button = page.getByRole("button", { name: action, exact: true });
      await button.evaluate(element => element.scrollIntoView({ block: "center" }));
      await expect(button).toBeInViewport({ ratio: 1 });
      await board.scrollIntoViewIfNeeded();
      await expect(board).toBeInViewport({ ratio: 1 });
      expect((await documentBox(board)).width).toBeGreaterThan(size.width - 60);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    };
    await fits("Reveal move");
    await square("e2").tap();
    await square("e3").tap();
    await expect(page.locator(".move-status.retry")).toBeVisible();
    await fits("Reveal move");
    await square("e2").tap();
    await square("e4").tap();
    await expect(page.getByRole("button", { name: "Next position", exact: true })).toBeVisible();
    await fits("Next position");
    await page.screenshot({ path: `test-results/review-phone-${size.width}-${size.height}.png` });
    await page.getByText("Answer & review details", { exact: true }).click();
    await expect(page.getByText("A detailed explanation.", { exact: false })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole("button", { name: "Next position", exact: true }).click();
    await expect(page.locator(".load-state")).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});

test("review explanations replay the submitted move and return without another recall", async ({
  page,
}, testInfo) => {
  if (testInfo.project.name === "mobile") await page.setViewportSize({ width: 375, height: 600 });
  const fixture = await (
    await page.request.post(`/__test/review-explanation-fixture/playback-${testInfo.project.name}`)
  ).json();
  const before = await (await page.request.get("/api/stats")).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  const board = page.locator("main .board-shell");
  const play = async (uci: string) => {
    await board.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
    await board.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
  };
  await expect(page.getByRole("button", { name: "Show me why" })).toBeDisabled();
  await play(fixture.wrong);
  await expect(page.getByRole("heading", { name: "Mistake.", exact: true })).toBeVisible();
  await expect(board.locator('[data-square="a1"] [data-piece="bQ"]')).toBeVisible();
  await expect(board.locator('[data-square="a1"] [data-piece="wR"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show me why", exact: true })).toBeVisible();
  await expect(board).toHaveCSS("outline-color", "rgb(255, 98, 120)");
  await page.screenshot({ path: `test-results/counter-reply-${testInfo.project.name}.png` });
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(board).toHaveCSS("outline-style", "none");
  await expect(board.locator('[data-square="g1"] [data-piece="wK"]')).toBeVisible();
  await expect(board.locator('[data-square="a1"] [data-piece="wR"]')).toBeVisible();
  await play(fixture.wrong);
  await expect(page.getByRole("heading", { name: "Mistake.", exact: true })).toBeVisible();
  const originalBoard = await documentBox(board);
  const originalHeader = await documentBox(page.locator("header"));
  await page.getByRole("button", { name: "Show me why" }).click();
  const dialog = page.getByRole("region", { name: "Move explanation" });
  await expect(dialog.locator(".explanation-caption")).toContainText(
    "In this line, White loses 5 points of material.",
  );
  await expect(board.locator('[data-square="f1"] [data-piece="wK"]')).toBeVisible();
  await expect(dialog.locator(".explanation-caption")).toContainText("capturing White's rook");
  // Practice page heading styles must not inflate or squeeze the shared bubble.
  for (const label of await dialog.locator(".coach-title > *").all()) {
    expect(await label.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await expect(board.locator('[data-square="a1"] .playback-highlight')).toBeVisible();
  if (testInfo.project.name === "desktop") await expect(board).toBeInViewport({ ratio: 1 });
  const returnButton = dialog.getByRole("button", { name: "Back to attempt" });
  await expect(returnButton).toBeInViewport({ ratio: 1 });
  const shownBoard = await documentBox(board);
  expect(shownBoard).toEqual(originalBoard);
  await expect(board).toHaveCSS("outline-style", "none");
  // The phone header scrolls with the page, so compare its place in the document.
  expect(await documentBox(page.locator("header"))).toEqual(originalHeader);
  await expect(page.locator(".board-shell")).toHaveCount(1);
  if (testInfo.project.name === "mobile") {
    const control = (await documentBox(returnButton))!;
    expect(control.y + control.height).toBeLessThan(shownBoard!.y);
  }
  await expect(board.locator('[data-square="a1"] [data-piece="bQ"]')).toBeVisible();
  await page.screenshot({ path: `test-results/review-explanation-${testInfo.project.name}.png` });
  await dialog.getByRole("button", { name: "Previous move", exact: true }).click();
  await expect(dialog.locator(".explanation-caption")).toContainText("White plays Kf1");
  // The continuation's arrow keys step like its buttons while it is open.
  await page.keyboard.press("ArrowRight");
  await expect(dialog.locator(".explanation-caption")).toContainText("capturing White's rook");
  await page.keyboard.press("ArrowLeft");
  await expect(dialog.locator(".explanation-caption")).toContainText("White plays Kf1");
  await dialog.getByRole("button", { name: "Back to attempt" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(board.locator('[data-square="g1"] [data-piece="wK"]')).toBeVisible();
  await expect(page.locator(".move-status.retry")).toBeVisible();
  expect((await (await page.request.get("/api/stats")).json()).reviews).toBe(before.reviews + 1);
  await page.reload();
  await page.getByRole("button", { name: "Show me why" }).click();
  await expect(dialog.locator(".explanation-caption")).toContainText(
    "In this line, White loses 5 points of material.",
  );
  await dialog.getByRole("button", { name: "Back to attempt" }).click();
  await play(fixture.alternative);
  await expect(page.locator(".review-move")).toHaveText("Bxa5");
  await expect(page.getByRole("button", { name: "Next position" })).toBeVisible();
  await page.getByRole("button", { name: "Show why", exact: true }).click();
  await expect(dialog.locator(".explanation-caption")).toContainText(
    "In this line, White gains 9 points of material.",
  );
  await expect(board.locator('[data-square="a5"] [data-piece="wB"]')).toBeVisible();
  const backToReview = dialog.getByRole("button", { name: "Back to review" });
  await expect(backToReview).toBeInViewport({ ratio: 1 });
  const successBoard = await documentBox(board);
  if (testInfo.project.name === "mobile") {
    const control = (await documentBox(backToReview))!;
    expect(control.y + control.height).toBeLessThan(successBoard!.y);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");
  expect((await (await page.request.get("/api/stats")).json()).reviews).toBe(before.reviews + 1);
});

test("Reveal move plays the answer on the main board after a failed counter preview", async ({
  page,
}, testInfo) => {
  const fixture = await (
    await page.request.post(`/__test/review-explanation-fixture/reveal-${testInfo.project.name}`)
  ).json();
  const before = await (await page.request.get("/api/stats")).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  const board = page.getByRole("region", { name: "Chess position" });
  await board.locator('[data-square="g1"]').click();
  await board.locator('[data-square="f1"]').click();
  await expect(page.getByRole("heading", { name: "Mistake.", exact: true })).toBeVisible();
  // The counter-reply preview speaks through the coach's one live region too.
  const liveRegions = page
    .locator(".review-coach")
    .locator('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"]');
  await expect(liveRegions).toHaveCount(1);
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await page.getByRole("button", { name: "Reveal move", exact: true }).click();
  await expect(liveRegions).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Move revealed." })).toBeVisible();
  await expect(board.locator('[data-square="a5"] [data-piece="wR"]')).toBeVisible();
  await expect(board.locator('[data-square="a5"] [data-piece="bQ"]')).toHaveCount(0);
  await expect(board.locator('[data-square="a1"] [data-piece="wR"]')).toHaveCount(0);
  await expect(board.locator('[data-square="a5"] .playback-highlight')).toBeVisible();
  await expect(board.locator('[data-square="a1"] .playback-highlight')).toBeVisible();
  await page.getByRole("button", { name: "Show why", exact: true }).click();
  const dialog = page.getByRole("region", { name: "Move explanation" });
  await expect(board.locator('[data-square="a5"] [data-piece="wR"]')).toBeVisible();
  // The explanation's coach has one live region as well.
  await expect(dialog.locator(".explanation-caption")).toBeVisible();
  await expect(
    dialog.locator('[aria-live]:not([aria-live="off"]), [role="status"], [role="alert"]'),
  ).toHaveCount(1);
  await dialog.getByRole("button", { name: "Back to review" }).click();
  await expect(board.locator('[data-square="a5"] [data-piece="wR"]')).toBeVisible();
  expect((await (await page.request.get("/api/stats")).json()).reviews).toBe(before.reviews + 1);
});

test("an unavailable grading request never marks the board as a mistake", async ({ page }) => {
  const response = await page.request.post("/api/exercises/manual", {
    data: {
      fen: "1k6/8/8/8/8/8/4P3/4K3 w - - 0 1",
      moves: ["e2e4"],
    },
  });
  const { id } = await response.json();
  await page.goto(`/?exercise=${id}`);
  await page.route("**/api/review/sessions/*/move", route =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ detail: "Analysis unavailable. Please retry." }),
    }),
  );
  const before = (await (await page.request.get("/api/stats")).json()).reviews;
  const board = page.locator(".board-shell");
  await board.locator('[data-square="e2"]').click();
  await board.locator('[data-square="e3"]').click();
  await expect(page.getByRole("alert")).toContainText("Analysis unavailable");
  await expect(board).toHaveCSS("outline-style", "none");
  await expect(page.getByRole("heading", { name: "Mistake.", exact: true })).toHaveCount(0);
  expect((await (await page.request.get("/api/stats")).json()).reviews).toBe(before);
});

test("focused practice highlights a verified pattern without scheduling a recall", async ({
  page,
}, testInfo) => {
  const fixture = await (
    await page.request.post(`/__test/classified-fixture/focus-${testInfo.project.name}`)
  ).json();
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: "Insights", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Insight sections" })
    .getByRole("link", { name: "Weaknesses", exact: true })
    .click();
  await expect(page.getByRole("region", { name: "Tactical patterns", exact: true })).toBeVisible();
  const weakness = page
    .locator(".weakness")
    .filter({ has: page.getByRole("heading", { name: "Missed tactical capture", exact: true }) });
  const before = (await (await page.request.get("/api/stats")).json()).reviews;
  await weakness.getByRole("link", { name: /Practice .* positions?/ }).click();
  await expect(page).toHaveURL(/\/study\/due\?focus=/);
  const focusedUrl = page.url();
  // Other tests' cards in this skill can lead the focused queue (a lapse or a later
  // review sorts them first), so open this fixture's card in place of the entry.
  await page.evaluate(
    url => location.replace(url),
    `${focusedUrl}&exercise=${fixture.exercise_id}`,
  );
  await page.waitForURL(url => url.searchParams.get("exercise") === fixture.exercise_id);
  await expect(page.getByText("FOCUSED PRACTICE", { exact: true })).toBeAttached();
  await expect(page.getByText("practiced this session", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Your move." })).toBeVisible();
  await page.getByRole("button", { name: "Reveal move", exact: true }).click();
  await expect(
    page.getByText("Focused practice. Your review schedule is unchanged."),
  ).toBeVisible();
  const board = page.locator(".board-shell");
  const box = await documentBox(board);
  await page.getByRole("button", { name: "Show why", exact: true }).click();
  await page.getByRole("button", { name: "Show undefended capture", exact: true }).click();
  await expect(board.locator("[data-pattern-square]")).toHaveCount(2);
  await expect(board.locator('[data-pattern-square="a5"]')).toBeVisible();
  await expect(board.locator('[data-square="a5"] [data-piece="bQ"]')).toBeVisible();
  await expect(board.locator('[data-square="a1"] [data-piece="wR"]')).toBeVisible();
  expect(await documentBox(board)).toEqual(box);
  await expect(page.getByText("Next time:", { exact: false })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: `test-results/pattern-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Back to review", exact: true }).click();
  await expect(board.locator("[data-pattern-square]")).toHaveCount(0);
  expect((await (await page.request.get("/api/stats")).json()).reviews).toBe(before);
  await page.getByRole("link", { name: "Return to mixed review", exact: true }).click();
  await expect(page).toHaveURL("/study/due");
  await expect(page.getByText("FOCUSED PRACTICE", { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(url => url.href.startsWith(focusedUrl));
  await expect(page.getByText("FOCUSED PRACTICE", { exact: true })).toBeAttached();
  await expect(
    page.getByRole("link", { name: "Return to mixed review", exact: true }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/insights?section=patterns");
  await expect(weakness).toBeVisible();
  expect(fixture.exercise_id).toBeTruthy();
});
