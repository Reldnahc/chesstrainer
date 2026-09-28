import { test, expect, type Page } from "@playwright/test";

async function openGame(page: Page, suffix: string) {
  const { id } = await (await page.request.post(`/__test/game-review-fixture/variation-nav-${suffix}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  // Navigation uses real legal positions; engine work is irrelevant to this check.
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: "navigation", status: "completed"}}));
  await page.route(`**/api/games/${id}/analyze`, route => route.fulfill({json: {report: null, score: null, best_move: null}}));
  await page.goto(`/games/${id}?ply=2`);
  await expect(page.getByText("Original game", {exact: true})).toBeVisible();
  const play = async (uci: string) => {
    await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
    await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
    await expect(page.getByText("Exploring a variation", {exact: true})).toBeVisible();
    await expect(page.locator(".game-variation-row button[aria-pressed=true]")).toContainText(
      uci === "e2e4" ? "e4" : "Nc6",
    );
  };
  const onMainline = async (ply: number) => {
    await expect(page.getByText("Original game", {exact: true})).toBeVisible();
    await expect(page.getByRole("button", {name: "Return to game", exact: true})).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/games/${id}${ply ? `\\?ply=${ply}` : ""}$`));
    if (ply > 0) await expect(page.locator(".game-move-list button[aria-current=step]")).toHaveAccessibleName(
      new RegExp(` ${game.frames[ply].san}(,|$)`),
    );
  };
  return {id, game, play, onMainline};
}

test("variation return is a prominent coach action and restores the original position", async ({page}, info) => {
  const {id, game, play, onMainline} = await openGame(page, `return-${info.project.name}`);
  await page.evaluate(() => document.fonts.ready);
  const boardWidth = (await page.locator(".board-shell").boundingBox())!.width;
  const actionsHeight = (await page.locator(".coach-actions").boundingBox())!.height;
  if (info.project.name === "desktop") {
    const centers = await page.getByRole("group", {name: "Game navigation"}).evaluate(controls => {
      const row = controls.getBoundingClientRect();
      const first = controls.querySelector('[aria-label="First move"]')!.getBoundingClientRect();
      const last = controls.querySelector('[aria-label="Last move"]')!.getBoundingClientRect();
      const flip = controls.querySelector('[aria-label="Flip board"]')!.getBoundingClientRect();
      return {row: (row.left + row.right) / 2, moves: (first.left + last.right) / 2, right: row.right, flipRight: flip.right};
    });
    expect(Math.abs(centers.row - centers.moves)).toBeLessThan(1);
    expect(Math.abs(centers.right - centers.flipRight)).toBeLessThan(1);
  }
  await play("e2e4");
  const back = page.getByRole("button", {name: "Return to game", exact: true});
  await expect(page.locator(".coach-actions").getByRole("button", {name: "Return to game"})).toBeVisible();
  await expect(page.getByRole("group", {name: "Game navigation"}).getByRole("button", {name: "Return to game"})).toHaveCount(0);
  const layout = await back.evaluate(button => {
    const bounds = button.getBoundingClientRect();
    const actions = button.closest(".coach-actions")!;
    const why = actions.querySelector("button[aria-pressed]")!.getBoundingClientRect();
    const speech = button.closest(".review-coach")!.querySelector(".coach-speech")!.getBoundingClientRect();
    return {
      width: bounds.width, height: bounds.height, top: bounds.top,
      actionsHeight: actions.getBoundingClientRect().height, speechBottom: speech.bottom,
      whyTop: why.top, whyHeight: why.height, gap: bounds.left - why.right,
      color: getComputedStyle(button).backgroundColor,
      secondaryColor: getComputedStyle(actions.querySelector("button[aria-pressed]")!).backgroundColor,
    };
  });
  expect(layout.top).toBeGreaterThanOrEqual(layout.speechBottom);
  expect(layout.height).toBeGreaterThanOrEqual(44);
  expect(layout.top).toBeCloseTo(layout.whyTop, 1);
  expect(layout.height).toBe(layout.whyHeight);
  expect(layout.gap).toBe(8);
  expect(layout.actionsHeight).toBe(actionsHeight);
  expect(layout.color).not.toBe(layout.secondaryColor);
  expect((await page.locator(".board-shell").boundingBox())!.width).toBe(boardWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator(".review-coach").screenshot({path: `test-results/variation-return-${info.project.name}.png`});
  if (info.project.name === "mobile") {
    await page.setViewportSize({width: 320, height: 700});
    const why = (await page.getByRole("button", {name: "Show why", exact: true}).boundingBox())!;
    const returning = (await back.boundingBox())!;
    expect(returning.y).toBe(why.y);
    expect(returning.x).toBe(why.x + why.width + 8);
    expect((await page.locator(".coach-actions").boundingBox())!.height).toBe(actionsHeight);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator(".review-coach").screenshot({path: "test-results/variation-return-small-phone.png"});
  }
  await back.click();
  await onMainline(2);
  await expect(page.locator(".coach-speech")).toContainText("e5");
  await expect(page.locator(".game-variation-row")).toHaveCount(1);
  expect((await (await page.request.get(`/api/games/${id}`)).json()).frames).toEqual(game.frames);
});

test("backward navigation exits a variation when it reaches the original branch point", async ({page}, info) => {
  const {play, onMainline} = await openGame(page, `back-${info.project.name}`);
  await play("e2e4");
  await play("b8c6");
  for (const input of ["button", "keyboard"]) {
    await page.locator(".game-variation-row button").last().click();
    const previous = () => input === "button"
      ? page.getByRole("button", {name: "Previous move", exact: true}).click()
      : page.keyboard.press("ArrowLeft");
    await previous();
    await expect(page.getByText("Exploring a variation", {exact: true})).toBeVisible();
    await expect(page.locator(".game-variation-row button[aria-pressed=true]")).toContainText("e4");
    await previous();
    await onMainline(2);
    await previous();
    await onMainline(1);
  }
});

test("first move always exits variations at original-game ply one", async ({page}, info) => {
  const {play, onMainline} = await openGame(page, `first-${info.project.name}`);
  await play("e2e4");
  const first = page.getByRole("button", {name: "First move", exact: true});
  await expect(first).toBeEnabled();
  await first.click();
  await onMainline(1);
  await expect(first).toBeDisabled();
  await page.getByRole("button", {name: "Previous move", exact: true}).click();
  await onMainline(0);
  await expect(first).toBeEnabled();
  await first.click();
  await onMainline(1);
  await page.getByRole("button", {name: "Last move", exact: true}).click();
  await first.click();
  await onMainline(1);
  await page.locator(".game-variation-row button").first().click();
  await first.click();
  await onMainline(1);
});
