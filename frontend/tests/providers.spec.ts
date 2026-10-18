import { test, expect } from "./helpers/browserTest";

test.afterEach(async ({ request }) => {
  for (const provider of ["chesscom", "lichess"]) {
    expect(
      (await request.put(`/api/providers/${provider}/connection`, { data: { username: "" } })).ok(),
    ).toBe(true);
  }
});

test("background syncs refresh the game list in place, once per finished check", async ({
  page,
}, info) => {
  expect(
    (await page.request.post(`/__test/game-review-fixture/sync-refresh-${info.project.name}`)).ok(),
  ).toBe(true);
  const sync = (job_id: string, status: string, imported: number) => ({
    provider: "chesscom",
    username: "walter",
    job_id,
    status,
    checked_at: `2026-10-11T00:00:0${job_id}+00:00`,
    imported,
    error: null,
  });
  let current = sync("1", "completed", 0);
  await page.route("**/api/providers/*/sync", route =>
    new URL(route.request().url()).pathname.includes("/chesscom/")
      ? route.fulfill({ json: current })
      : route.fulfill({
          json: {
            provider: "lichess",
            username: "",
            job_id: null,
            status: "not_started",
            checked_at: null,
            imported: 0,
            error: null,
          },
        }),
  );
  let listReads = 0;
  page.on("request", request => {
    if (new URL(request.url()).pathname === "/api/games") listReads++;
  });
  await page.clock.install();
  await page.goto("/games");
  const library = page.getByRole("region", { name: "Game history", exact: true });
  await expect(library).toBeVisible();
  // The first pass must finish before the status changes: otherwise the running
  // check becomes the baseline, or the next tick is dropped while it is in flight.
  await expect(page.getByRole("button", { name: "Update games", exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const seen = window as unknown as { blanked: boolean };
    seen.blanked = false;
    new MutationObserver(() => {
      if (document.body.textContent?.includes("Loading your games")) seen.blanked = true;
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  // The first status is only a baseline, and a running check changes nothing yet.
  current = sync("2", "running", 0);
  await page.clock.runFor(15000);
  await expect(page.getByRole("button", { name: "Updating…" })).toBeVisible();
  expect(listReads).toBe(1);
  current = sync("2", "completed", 1);
  await page.clock.runFor(15000);
  await expect.poll(() => listReads).toBe(2);
  await expect(library).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { blanked: boolean }).blanked)).toBe(
    false,
  );
});

test("local saved connections refresh both providers and survive reload", async ({
  page,
}, info) => {
  const lichess = `lichess-sync-${info.project.name}`;
  const chesscom = `chesscom-sync-${info.project.name}`;
  await page.goto("/settings");
  for (const [name, username] of [
    ["Chess.com", chesscom],
    ["Lichess", lichess],
  ]) {
    const region = page.getByRole("region", { name: `Recent ${name} games`, exact: true });
    const summary = region.locator("summary");
    const details = region.locator("details");
    if ((await details.count()) && !(await details.evaluate(el => (el as HTMLDetailsElement).open)))
      await summary.click();
    await region.getByLabel(`Remembered ${name} username`).fill(username);
    await region.getByRole("button", { name: "Save username", exact: true }).click();
    await expect(region.locator("summary")).toHaveText(`Change ${name} connection`);
  }
  await expect(
    page.getByRole("region", { name: "Recent Lichess games", exact: true }).getByRole("status"),
  ).toContainText("Last sync:", { timeout: 20000 });
  await page.reload();
  for (const [name, username] of [
    ["Chess.com", chesscom],
    ["Lichess", lichess],
  ]) {
    const region = page.getByRole("region", { name: `Recent ${name} games`, exact: true });
    await region.locator("summary").click();
    await expect(region.getByLabel(`Remembered ${name} username`)).toHaveValue(username);
  }
  await page.getByRole("link", { name: "Games", exact: true }).click();
  const chessResponse = page.waitForResponse(
    r => r.url().endsWith("/api/providers/chesscom/sync") && r.request().method() === "POST",
  );
  const lichessResponse = page.waitForResponse(
    r => r.url().endsWith("/api/providers/lichess/sync") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Update games", exact: true }).click();
  expect((await chessResponse).ok()).toBe(true);
  expect((await lichessResponse).ok()).toBe(true);
  await expect(page.locator(".game-library-item").filter({ hasText: lichess })).toHaveCount(1);
  await expect(page.locator(".game-library-item").filter({ hasText: chesscom })).toHaveCount(1);
  // Leave the shared local test workspace disconnected for the other UI tests.
  for (const provider of ["chesscom", "lichess"]) {
    expect(
      (
        await page.request.put(`/api/providers/${provider}/connection`, { data: { username: "" } })
      ).ok(),
    ).toBe(true);
  }
});

test("saved-name hydration cannot merge with an in-progress manual username", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => {
    release = resolve;
  });
  await page.route("**/api/providers/chesscom/sync", async route => {
    await gate;
    await route.fulfill({
      json: {
        provider: "chesscom",
        username: "saved-name",
        job_id: null,
        status: "not_started",
        checked_at: null,
        imported: 0,
        error: null,
      },
    });
  });
  try {
    await page.goto("/settings?import=chesscom");
    const field = page.getByLabel("Chess.com username", { exact: true });
    await expect(field).toBeDisabled();
    release();
    await expect(field).toBeEnabled();
    await expect(field).toHaveValue("saved-name");
    await field.fill("replacement");
    await expect(field).toHaveValue("replacement");
  } finally {
    release();
    await page.unrouteAll({ behavior: "wait" });
  }
});
