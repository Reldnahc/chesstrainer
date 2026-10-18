import { test, expect, type Page } from "./helpers/browserTest";
import type { Job, Schema } from "../src/api";

const sections = (page: Page) => page.getByRole("navigation", { name: "Settings sections" });
const connection = (page: Page, name: string) =>
  page.getByRole("region", { name: `Recent ${name} games`, exact: true });

function syncStatus(provider: string, username = ""): Schema["SyncStatus"] {
  return {
    provider,
    username,
    status: "not_started",
    checked_at: null,
    imported: 0,
    job_id: null,
    error: null,
  };
}

test.beforeEach(async ({ page }) => {
  // Keep settings navigation and source choices independent of prior imports.
  await page.route("**/api/jobs", route => route.fulfill({ json: [] }));
  await page.route("**/api/providers/*/sync", route => {
    const provider = new URL(route.request().url()).pathname.split("/")[3];
    return route.fulfill({ json: syncStatus(provider) });
  });
});

test("settings sections mount only their controls and restore through Back, Forward and reload", async ({
  page,
}, info) => {
  const documents: string[] = [];
  page.on("request", request => {
    if (request.isNavigationRequest()) documents.push(request.url());
  });
  await page.goto("/settings");
  // A local install's single user manages its courses, so Courses is listed from the start.
  await expect(sections(page).getByRole("link")).toHaveText([
    "Games & imports",
    "Coach & animations",
    "Sound",
    "Courses",
    "Advanced",
  ]);
  await expect(
    sections(page).getByRole("link", { name: "Games & imports", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(connection(page, "Chess.com")).toBeVisible();
  await expect(connection(page, "Lichess")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import PGN", exact: true })).toBeVisible();
  await expect(page.getByLabel("Chess.com username", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("PGN", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Animations", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sound", exact: true })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Account", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Classify saved games", exact: true })).toHaveCount(
    0,
  );
  await expect(connection(page, "Lichess").getByLabel("Remembered Lichess username")).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `test-results/settings-imports-${info.project.name}.png`,
    fullPage: true,
  });
  const initialHistory = await page.evaluate(() => history.length);
  await sections(page).getByRole("link", { name: "Games & imports", exact: true }).click();
  expect(await page.evaluate(() => history.length)).toBe(initialHistory);

  await sections(page).getByRole("link", { name: "Coach & animations", exact: true }).click();
  await expect(page).toHaveURL("/settings?section=coach");
  await expect(page.getByRole("radio")).toHaveCount(30);
  await expect(page.getByRole("region", { name: "Animations", exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sound", exact: true })).toHaveCount(0);
  await expect(connection(page, "Chess.com")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Classify saved games", exact: true })).toHaveCount(
    0,
  );
  await page.screenshot({
    path: `test-results/settings-coaches-${info.project.name}.png`,
    fullPage: true,
  });
  await sections(page).getByRole("link", { name: "Sound", exact: true }).click();
  await expect(page).toHaveURL("/settings?section=sound");
  await expect(page.getByRole("region", { name: "Sound", exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Animations", exact: true })).toHaveCount(0);
  await expect(connection(page, "Chess.com")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Classify saved games", exact: true })).toHaveCount(
    0,
  );
  await sections(page).getByRole("link", { name: "Advanced", exact: true }).click();
  await expect(page).toHaveURL("/settings?section=advanced");
  await expect(
    page.getByRole("button", { name: "Classify saved games", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Deepen unclear positions", exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Sound", exact: true })).toHaveCount(0);
  await expect(connection(page, "Chess.com")).toHaveCount(0);
  expect(await page.evaluate(() => history.length)).toBe(initialHistory + 3);
  await page.goBack();
  await expect(page).toHaveURL("/settings?section=sound");
  await expect(page.getByRole("region", { name: "Sound", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL("/settings?section=coach");
  await expect(page.getByRole("radio")).toHaveCount(30);
  await page.goBack();
  await expect(page).toHaveURL("/settings");
  await expect(connection(page, "Chess.com")).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL("/settings?section=coach");
  await page.goForward();
  await expect(page).toHaveURL("/settings?section=sound");
  expect(documents).toHaveLength(1);
  await page.reload();
  await expect(sections(page).getByRole("link", { name: "Sound", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.getByRole("region", { name: "Sound", exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
});

test("import actions and deep links select their form without reloading settings", async ({
  page,
}) => {
  const documents: string[] = [];
  page.on("request", request => {
    if (request.isNavigationRequest()) documents.push(request.url());
  });
  await page.goto("/settings?import=chesscom");
  await expect(
    page.getByRole("heading", { name: "Import from Chess.com", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Import games", exact: true })).toBeVisible();
  await connection(page, "Lichess")
    .getByRole("button", { name: "Import older games", exact: true })
    .click();
  await expect(page).toHaveURL("/settings?import=lichess");
  await expect(
    page.getByRole("heading", { name: "Import from Lichess", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Chess.com username", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Import PGN", exact: true }).click();
  await expect(page).toHaveURL("/settings?import=pgn");
  await expect(page.getByRole("heading", { name: "Import PGN", exact: true })).toBeVisible();
  await expect(page.getByLabel("Lichess username", { exact: true })).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("heading", { name: "Import from Lichess", exact: true }),
  ).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("heading", { name: "Import PGN", exact: true })).toBeVisible();
  expect(documents).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Import PGN", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close import form", exact: true }).click();
  await expect(page).toHaveURL("/settings");
  await expect(page.locator(".import-form-body")).toHaveCount(0);
});

test("PGN source choices are exclusive and imports offer no analysis choice", async ({ page }) => {
  const uploads: string[] = [];
  await page.route("**/api/imports", route => {
    uploads.push(route.request().postDataBuffer()!.toString());
    return route.fulfill({ json: { imported: 1, duplicates: 0, errors: [], job_id: null } });
  });
  await page.goto("/settings?import=pgn");
  const file = page.getByLabel("PGN file", { exact: true });
  const text = page.getByLabel("PGN", { exact: true });
  await expect(file).toHaveCount(1);
  await expect(text).toHaveCount(0);
  await expect(page.locator(".import-form").getByRole("checkbox")).toHaveCount(0);
  await file.setInputFiles({
    name: "file-games.pgn",
    mimeType: "text/plain",
    buffer: Buffer.from('[Event "File source"]\n\n1. d4 d5 *'),
  });
  await page.getByRole("button", { name: "Paste PGN text", exact: true }).click();
  await expect(file).toHaveCount(0);
  await expect(text).toBeVisible();
  await text.fill('[Event "Pasted source"]\n[White "Learner"]\n\n1. e4 e5 *');
  await page.getByLabel("Your username(s)").fill("Learner");
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect(page.locator(".import-form").getByRole("status")).toContainText("1 imported");
  expect(uploads).toHaveLength(1);
  expect(uploads[0]).toContain("Pasted source");
  expect(uploads[0]).not.toContain("File source");
  expect(uploads[0]).not.toContain('name="analyze"');
  await page.getByRole("button", { name: "Choose a file", exact: true }).click();
  await expect(text).toHaveCount(0);
  await file.setInputFiles({
    name: "chosen-games.pgn",
    mimeType: "text/plain",
    buffer: Buffer.from('[Event "Chosen file source"]\n\n1. d4 d5 *'),
  });
  await page.getByRole("button", { name: "Import games", exact: true }).click();
  await expect.poll(() => uploads.length).toBe(2);
  expect(uploads[1]).toContain("Chosen file source");
  expect(uploads[1]).not.toContain("Pasted source");
  expect(uploads[1]).not.toContain('name="analyze"');
});

test("activity stays compact when empty and bounds completed history without hiding active work", async ({
  page,
}) => {
  await page.goto("/settings");
  const activity = page.getByRole("region", { name: "Import & analysis activity", exact: true });
  await expect(activity).toBeVisible();
  await expect(activity.locator(".job")).toHaveCount(0);
  expect((await activity.boundingBox())!.height).toBeLessThan(240);
  const job = (id: string, status: Job["status"]): Job => ({
    id,
    status,
    kind: "analysis",
    user_id: "settings-fixture",
    created_at: "2026-09-29T10:00:00Z",
    activity: null,
    cancel_requested: false,
    classifications_completed: 1,
    priority: 0,
    puzzles_found: 0,
    deep_completed: 1,
    error: null,
    games_processed: status === "completed" ? 1 : 0,
    games_total: 1,
    import_id: null,
    mistakes_identified: 1,
    positions_triaged: 2,
    probe_total: null,
    provider_import: null,
  });
  const jobs = [
    ...Array.from({ length: 8 }, (_, index) => job(`done-${index}`, "completed")),
    job("running", "running"),
    job("queued", "queued"),
  ];
  await page.route("**/api/jobs", route => route.fulfill({ json: jobs }));
  await page.reload();
  await expect(activity.locator(".job-history")).toHaveCount(3);
  await expect(activity.locator(".job:not(.job-history)")).toHaveCount(2);
  await expect(activity.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(2);
  const completed = activity.locator(".job-history").first();
  await expect(completed.locator("details")).not.toHaveAttribute("open");
  await expect(completed.getByRole("progressbar")).toHaveCount(0);
  await completed.locator("summary").click();
  await expect(completed.getByRole("progressbar", { name: "Analysis progress" })).toBeVisible();
  await activity.getByRole("button", { name: "Show older activity (5)", exact: true }).click();
  await expect(activity.locator(".job-history")).toHaveCount(8);
  await activity.getByRole("button", { name: "Show recent activity", exact: true }).click();
  await expect(activity.locator(".job-history")).toHaveCount(3);
  await expect(activity.getByRole("button", { name: "Cancel", exact: true })).toHaveCount(2);
});
