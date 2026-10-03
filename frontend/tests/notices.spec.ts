import { expect, test, type Locator } from "@playwright/test";
import type { Job, Schema } from "../src/api";

async function expectPassive(notice: Locator) {
  await expect(notice).toBeVisible();
  expect(await notice.getAttribute("role")).toBeNull();
  expect(await notice.getAttribute("aria-live")).toBeNull();
  await expect(notice.locator('[role="alert"], [role="status"], [aria-live]')).toHaveCount(0);
}

test("training queue results update the same mounted status across consecutive requests", async ({ page }) => {
  await page.goto("/settings?section=advanced");
  const status = page.locator(".settings-tool-status").getByRole("status");
  await expect(status).toHaveCount(1);
  await expect(status).toHaveText("");
  await expect(status).toHaveCSS("display", "flex");
  await expect(status).toHaveCSS("visibility", "visible");
  await expect(status).toHaveCSS("margin-bottom", "0px");
  expect(await status.getAttribute("aria-hidden")).toBeNull();
  expect(await status.evaluate(element => element.getBoundingClientRect().height)).toBe(0);
  const original = await status.elementHandle();
  try {
    for (let request = 0; request < 2; request++) {
      let release!: () => void;
      let entered!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const arrived = new Promise<void>(resolve => { entered = resolve; });
      let operation: Promise<void> | undefined;
      const pattern = "**/api/classifications/retry";
      await page.route(pattern, route => {
        operation = (async () => {
          entered();
          await gate;
          await route.fulfill({ json: { job_id: `notice-queued-${request}` } });
        })();
        return operation;
      }, { times: 1 });
      try {
        await page.getByRole("button", { name: "Classify saved games", exact: true }).click();
        await arrived;
        await expect(status).toHaveText("");
        await expect(status).toHaveCSS("margin-bottom", "0px");
        expect(await status.evaluate(element => element.getBoundingClientRect().height)).toBe(0);
        expect(await original!.evaluate(element => element === document.querySelector(".settings-tool-status [role=status]"))).toBe(true);
        release();
        await operation;
        await expect(status).toHaveText("Training labels queued.");
        await expect(status).toBeVisible();
        await expect(status).toHaveAttribute("aria-atomic", "true");
        expect(await original!.evaluate(element => element === document.querySelector(".settings-tool-status [role=status]"))).toBe(true);
      } finally {
        release();
        await operation;
        await page.unroute(pattern);
      }
    }
  } finally {
    await original?.dispose();
  }
});

test("current application errors remain alerts and their shared action dismisses them", async ({ page }) => {
  let first = true;
  await page.route("**/api/jobs", route => {
    if (first) {
      first = false;
      return route.fulfill({ status: 503, json: { detail: "Import activity could not be loaded." } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto("/settings");
  const notice = page.getByRole("alert").filter({ hasText: "Import activity could not be loaded." });
  await expect(notice).toHaveClass(/notice--panel/);
  await expect(notice).toHaveAttribute("data-tone", "error");
  await expect(notice).toHaveAttribute("aria-atomic", "true");
  const dismiss = notice.getByRole("button", { name: "Dismiss error", exact: true });
  await expect(dismiss).toBeVisible();
  await dismiss.focus();
  await page.keyboard.press("Enter");
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Settings", exact: true })).toBeVisible();
});

test("import confirmation is a status while existing engine availability stays passive", async ({ page }) => {
  await page.route("**/api/health", route => route.fulfill({ json: {
    database: "ready", classification_available: true, engine_status: "unavailable",
    engine_available: false, engine_error: "Stockfish is unavailable. Check the server logs.", engine_version: null,
  } }));
  const result: Schema["PgnImportResult"] = {
    imported: 2, duplicates: 1, processed: 4, import_id: "notice-import", job_id: null,
    errors: [{ game: 4, error: "The PGN move sequence was invalid." }],
  };
  await page.route("**/api/imports", route => route.fulfill({ json: result }));
  await page.goto("/settings?import=pgn");
  const engine = page.locator(".notice").filter({ hasText: "Stockfish is unavailable." });
  await expectPassive(engine);
  await page.getByRole("button", { name: "Paste PGN text", exact: true }).click();
  await page.getByLabel("PGN", { exact: true }).fill('[Event "Notice fixture"]\n[White "Learner"]\n\n1. e4 e5 *');
  await page.getByLabel("Your username(s)").fill("Learner");
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  const confirmation = page.locator(".import-form").getByRole("status").filter({ hasText: "2 imported" });
  await expect(confirmation).toHaveClass(/notice/);
  await expect(confirmation).toHaveAttribute("aria-atomic", "true");
  await expect(confirmation).toContainText("1 duplicate(s)");
  await expect(confirmation).toContainText("Game 4: The PGN move sequence was invalid.");
  await expect(confirmation.getByRole("alert")).toHaveCount(0);
  await expectPassive(engine);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("opening failed import history never re-announces saved errors as current alerts", async ({ page }) => {
  const job: Job = {
    id: "notice-history", kind: "provider_fetch", status: "failed", user_id: "notice-fixture",
    created_at: "2026-09-29T10:00:00Z", activity: null, cancel_requested: false, chesscom: null,
    classifications_completed: 0, priority: 0, puzzles_found: 0, deep_completed: 0, games_processed: 0, games_total: 0,
    import_id: null, mistakes_identified: 0, positions_triaged: 0, probe_total: null,
    error: "A previously saved download was interrupted.",
    provider_import: {
      archives_processed: 1, archives_total: 2, duplicates: 0, end_date: null,
      errors: [{ game: 3, error: "A saved game had an invalid move." }],
      fetch_completed: false, filtered: 0, games_fetched: 1, games_imported: 0,
      job_id: "notice-history", max_games: 20, months: 3, provider: "chesscom",
      provider_name: "Chess.com", rejected: 1, start_date: null, time_class: "rapid",
      user_id: "notice-fixture", username: "notice-history-player",
    },
  };
  await page.route("**/api/jobs", route => route.fulfill({ json: [job] }));
  await page.goto("/settings");
  const history = page.locator(".job-history").filter({ hasText: "notice-history-player" });
  await expect(history.locator("details").first()).not.toHaveAttribute("open");
  await history.locator("summary").first().click();
  const savedError = history.locator(".notice").filter({ hasText: job.error! });
  await expectPassive(savedError);
  await expect(savedError).toHaveAttribute("data-tone", "error");
  await history.locator("summary").filter({ hasText: "Import issues (1)" }).click();
  await expectPassive(history.locator(".notice").filter({ hasText: "A saved game had an invalid move." }));
  await expect(history.getByRole("alert")).toHaveCount(0);
  await expect(history.getByRole("status")).toHaveCount(0);
  await expect(history.getByRole("button", { name: "Retry saved work", exact: true })).toBeVisible();
  await history.locator("summary").first().click();
  await history.locator("summary").first().click();
  await expectPassive(savedError);
});

test("account form failures use the same alert without changing form behavior", async ({ page }) => {
  await page.route("**/api/auth/me", route => route.fulfill({ json: { enabled: true, user: null } }));
  await page.route("**/api/auth/login", route => route.fulfill({ status: 401, json: { detail: "The username or password was incorrect." } }));
  await page.goto("/");
  await page.getByLabel("Username", { exact: true }).fill("notice-account");
  await page.getByLabel("Password", { exact: true }).fill("test-only-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const notice = page.getByRole("alert").filter({ hasText: "The username or password was incorrect." });
  await expect(notice).toHaveClass(/notice--panel/);
  await expect(notice).toHaveAttribute("data-tone", "error");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
  await expect(page.getByLabel("Username", { exact: true })).toHaveValue("notice-account");
});

test("compact game-sync failures and full connection failures share error announcements", async ({ page }) => {
  await page.route("**/api/providers/chesscom/sync", route => route.fulfill({ json: {
    provider: "chesscom", username: "", job_id: null, status: "failed", checked_at: null,
    imported: 0, error: "The provider is temporarily unavailable. Try updating games later.",
  } }));
  await page.goto("/games");
  const compact = page.locator(".game-sync-compact").getByRole("alert");
  await expect(compact).toHaveClass(/notice--inline/);
  await expect(compact).toHaveAttribute("data-tone", "error");
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "Settings", exact: true }).click();
  const full = page.getByRole("region", { name: "Recent Chess.com games", exact: true }).getByRole("alert");
  await expect(full).toHaveClass(/notice--panel/);
  await expect(full).toHaveText("The provider is temporarily unavailable. Try updating games later.");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
