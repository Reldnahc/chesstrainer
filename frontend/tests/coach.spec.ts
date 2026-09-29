import { test, expect } from "@playwright/test";

test("the app offers coach selection without an expression viewer route", async ({ page }) => {
  await page.goto("/settings?section=coach");
  await expect(page.getByRole("radio", { name: "Walter", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Preview expressions" })).toHaveCount(0);
  await page.goto("/coach-studio");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await expect(page.getByLabel("Animation preview controls")).toHaveCount(0);
  await page.goto("/intelligence-lab");
  await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
  await page.getByRole("link", { name: "Go to your games" }).click();
  await expect(page).toHaveURL(/\/games$/);
});

test("coach motion follows the device by default and saved overrides survive reload", async ({ page }) => {
  await page.request.put("/api/preferences/coach", {
    data: { coach_id: "classic", motion: "system" },
  });
  try {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/settings?section=coach");
    const motion = page.getByLabel("Coach motion", { exact: true });
    const portrait = page.locator(".coach-option:has(input:checked) .coach-avatar");
    const motionStatus = page.locator(".coach-motion-preference-status");
    await expect(page.getByRole("radio")).toHaveCount(30);
    await expect(page.getByRole("radio", { name: "Walter", exact: true })).toBeChecked();
    await expect(motion).toHaveValue("system");
    await expect(motion.locator("option")).toHaveText(["Use device setting", "Animated", "Still"]);
    await expect(portrait).toHaveAttribute("data-motion", "still");
    await expect(motionStatus).toHaveText("Still · device setting");

    await motion.selectOption("natural");
    await expect(motionStatus).toHaveText("Saved");
    await expect(portrait).toHaveAttribute("data-motion", "natural");
    await page.reload();
    await expect(motion).toHaveValue("natural");
    await expect(portrait).toHaveAttribute("data-motion", "natural");
    await portrait.scrollIntoViewIfNeeded();
    await expect.poll(() => portrait.evaluate(element =>
      element.getAnimations({ subtree: true }).filter(animation => animation.playState === "running").length,
    )).toBeGreaterThan(0);
    await expect(motionStatus).toBeEmpty();

    await motion.selectOption("still");
    await expect(motionStatus).toHaveText("Saved");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.reload();
    await expect(motion).toHaveValue("still");
    await expect(portrait).toHaveAttribute("data-motion", "still");
    expect(await portrait.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);

    await motion.selectOption("system");
    await expect(motionStatus).toHaveText("Saved");
    await page.reload();
    await expect(motion).toHaveValue("system");
    await expect(portrait).toHaveAttribute("data-motion", "natural");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(portrait).toHaveAttribute("data-motion", "still");
    await expect(motionStatus).toHaveText("Still · device setting");
  } finally {
    await page.request.put("/api/preferences/coach", {
      data: { coach_id: "classic", motion: "system" },
    });
  }
});

test("coach motion resynchronizes after device changes while the settings page is unmounted", async ({ page }) => {
  await page.request.put("/api/preferences/coach", {
    data: { coach_id: "classic", motion: "system" },
  });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/settings?section=coach");
  const selected = page.locator(".coach-option:has(input:checked) .coach-avatar");
  await expect(selected).toHaveAttribute("data-motion", "natural");
  const motionStatus = page.locator(".coach-motion-preference-status");

  for (const reducedMotion of ["reduce", "no-preference", "reduce"] as const) {
    await page.getByRole("link", { name: "Games", exact: true }).click();
    await expect(page.locator(".coach-avatar")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion });
    await page.getByRole("link", { name: "Settings", exact: true }).click();
    await page.getByRole("navigation", { name: "Settings sections" }).getByRole("link", { name: "Coach & animations", exact: true }).click();
    await expect(selected).toHaveAttribute("data-motion", reducedMotion === "reduce" ? "still" : "natural");
    await expect(motionStatus).toHaveText(reducedMotion === "reduce" ? "Still · device setting" : "");
  }
});

test("game navigation and SRS attempts drive the real shared coach", async ({
  page,
}, info) => {
  test.setTimeout(60_000);
  const { id } = await (
    await page.request.post(
      `/__test/game-review-fixture/coach-${info.project.name}`,
    )
  ).json();
  await page.goto(`/games/${id}?ply=3`);
  const avatar = page.locator(".review-coach .coach-avatar");
  await expect(avatar).toHaveAttribute("data-expression", "blunder", {
    timeout: 30000,
  });
  await expect(page.locator(".game-summary caption")).toContainText("Complete game", {timeout: 30000});
  await page.getByRole("button", { name: "Last move", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "losing");
  await expect(page.locator(".coach-message")).toContainText(/checkmate|king has no escape/i);
  await page.getByRole("button", { name: "Start of game", exact: true }).click();
  await expect(page.getByRole("button", { name: "Previous move", exact: true })).toBeDisabled();
  await expect(avatar).toHaveAttribute("data-expression", "neutral");
  await expect(page.locator(".coach-message")).toContainText("Select a move");
  await expect(page.getByRole("region", {name: "Game story"})).toHaveCount(0);
  const fixture = await (
    await page.request.post(
      `/__test/review-explanation-fixture/coach-${info.project.name}`,
    )
  ).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  await expect(avatar).toHaveAttribute("data-expression", "neutral");
  const board = page.locator(".board-shell");
  const play = async (uci: string) => {
    await board.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
    await board.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
  };
  await play(fixture.wrong);
  await expect(avatar).toHaveAttribute("data-expression", "mistake");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "encouraging");
  await play(fixture.best);
  await expect(avatar).toHaveAttribute("data-expression", "recovered");
  await page.getByRole("button", { name: "Show why", exact: true }).click();
  await expect(avatar).toHaveAttribute("data-expression", "explaining");
  await page.screenshot({
    path: `test-results/coach-review-${info.project.name}.png`,
    fullPage: true,
  });
});

test("preference failures keep the last saved choice and allow recovery", async ({
  page,
}) => {
  await page.request.put("/api/preferences/coach", {
    data: { coach_id: "classic", motion: "natural" },
  });
  let failLoad = true;
  let failSave = true;
  await page.route("**/api/preferences/coach", async (route) => {
    const reading = route.request().method() === "GET";
    if ((reading && failLoad) || (!reading && failSave)) {
      if (reading) failLoad = false;
      else failSave = false;
      return route.fulfill({
        status: 503,
        json: {
          detail: reading
            ? "Preferences unavailable"
            : "Preference was not saved",
        },
      });
    }
    return route.continue();
  });
  try {
    await page.goto("/settings?section=coach");
    const motion = page.getByLabel("Coach motion", { exact: true });
    const status = page.locator(".coach-preference-status");
    const motionStatus = page.locator(".coach-motion-preference-status");
    await expect(status).toContainText("Preferences unavailable");
    await expect(motionStatus).toContainText("Preferences unavailable");
    await expect(motion).toBeDisabled();
    await expect(
      page.locator(".coach-option:has(input:checked) .coach-avatar"),
    ).toHaveAttribute("data-motion", "still");
    await page.getByRole("button", { name: "Reload coach motion preferences", exact: true }).click();
    await expect(motion).toBeEnabled();
    await expect(motion).toHaveValue("natural");
    const cat = page.getByRole("radio", { name: "Juniper", exact: true });
    await cat.click();
    await expect(status).toContainText("Preference was not saved");
    await expect(cat).not.toBeChecked();
    await expect(motion).toHaveValue("natural");
    expect(
      await (await page.request.get("/api/preferences/coach")).json(),
    ).toEqual({ coach_id: "classic", motion: "natural" });
    await cat.click();
    await expect(cat).toBeChecked();
    await expect(motion).toBeEnabled();
    failSave = true;
    await motion.selectOption("still");
    await expect(motionStatus).toContainText("Preference was not saved");
    await expect(motion).toHaveValue("natural");
    await expect(cat).toBeChecked();
    await motion.selectOption("still");
    await expect(motionStatus).toContainText("Saved");
    await page.reload();
    await expect(motion).toHaveValue("still");
    await expect(cat).toBeChecked();
  } finally {
    await page.request.put("/api/preferences/coach", {
      data: { coach_id: "classic", motion: "natural" },
    });
  }
});

test("connecting with a LAN token restores preferences without a page reload", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/preferences/motion", (route) =>
    route.request().headers().authorization === "Bearer coach-test-token"
      ? route.fulfill({ json: { motion: "natural" } })
      : route.fulfill({ status: 401, json: { detail: "LAN token required" } }),
  );
  await page.route("**/api/preferences/coach", (route) =>
    route.request().headers().authorization === "Bearer coach-test-token"
      ? route.fulfill({ json: { coach_id: "classic", motion: "still" } })
      : route.fulfill({ status: 401, json: { detail: "LAN token required" } }),
  );
  await page.goto("/settings?section=coach");
  await expect(
    page.getByRole("heading", { name: "Connect to your workspace" }),
  ).toBeVisible();
  await page
    .getByLabel("Access token", { exact: true })
    .fill("coach-test-token");
  await page.getByRole("button", { name: "Connect", exact: true }).click();
  const motion = page.getByLabel("Coach motion", { exact: true });
  await expect(motion).toBeEnabled();
  await expect(motion).toHaveValue("still");
  await expect(page.getByLabel("Piece & interface motion", {exact: true})).toHaveValue("natural");
  await expect(page.locator("html")).toHaveAttribute("data-interface-motion", "natural");
  await expect(
    page.locator(".coach-option:has(input:checked) .coach-avatar"),
  ).toHaveAttribute("data-motion", "still");
  await expect(
    page.getByRole("button", { name: "Reload preferences" }),
  ).toHaveCount(0);
});
