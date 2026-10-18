import { test, expect, type Page } from "./helpers/browserTest";

async function openGame(page: Page, suffix: string) {
  const { id } = await (
    await page.request.post(`/__test/game-review-fixture/variation-nav-${suffix}`)
  ).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  // Navigation uses real legal positions; engine work is irrelevant to this check.
  await page.route(`**/api/games/${id}/review`, route =>
    route.fulfill({ json: { job_id: "navigation", status: "completed" } }),
  );
  await page.route(`**/api/games/${id}/analyze`, route =>
    route.fulfill({ json: { report: null, score: null, best_move: null } }),
  );
  await page.goto(`/games/${id}?ply=2`);
  await expect(page.getByText("Original game", { exact: true })).toBeVisible();
  const play = async (uci: string) => {
    await page.locator(`.board-shell [data-square="${uci.slice(0, 2)}"]`).click();
    await page.locator(`.board-shell [data-square="${uci.slice(2, 4)}"]`).click();
    await expect(page.getByText("Exploring a variation", { exact: true })).toBeVisible();
    await expect(page.locator(".game-variation-row button[aria-pressed=true]")).toContainText(
      uci === "e2e4" ? "e4" : "Nc6",
    );
  };
  const onMainline = async (ply: number) => {
    await expect(page.getByText("Original game", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Return to game", exact: true })).toHaveCount(0);
    await expect(page).toHaveURL(new RegExp(`/games/${id}${ply ? `\\?ply=${ply}` : ""}$`));
    if (ply > 0)
      await expect(page.locator(".game-move-list button[aria-current=step]")).toHaveAccessibleName(
        new RegExp(` ${game.frames[ply].san}(,|$)`),
      );
  };
  return { id, game, play, onMainline };
}

test("backward navigation exits a variation when it reaches the original branch point", async ({
  page,
}, info) => {
  const { play, onMainline } = await openGame(page, `back-${info.project.name}`);
  await play("e2e4");
  await play("b8c6");
  for (const input of ["button", "keyboard"]) {
    await page.locator(".game-variation-row button").last().click();
    const previous = () =>
      input === "button"
        ? page.getByRole("button", { name: "Previous move", exact: true }).click()
        : page.keyboard.press("ArrowLeft");
    await previous();
    await expect(page.getByText("Exploring a variation", { exact: true })).toBeVisible();
    await expect(page.locator(".game-variation-row button[aria-pressed=true]")).toContainText("e4");
    await previous();
    await onMainline(2);
    await previous();
    await onMainline(1);
  }
});

test("start of variation exits to the branch point, then start of game reaches ply zero", async ({
  page,
}, info) => {
  const { play, onMainline } = await openGame(page, `first-${info.project.name}`);
  await play("e2e4");
  await play("b8c6");
  const toBranch = page.getByRole("button", { name: "Start of variation", exact: true });
  const first = page.getByRole("button", { name: "Start of game", exact: true });
  await expect(first).toHaveCount(0);
  await expect(toBranch).toBeEnabled();
  await toBranch.click();
  await onMainline(2);
  await expect(page.locator(".move-playback-counter")).toHaveText("2 / 4");
  await expect(toBranch).toHaveCount(0);
  await expect(first).toBeEnabled();
  await first.click();
  await onMainline(0);
  await expect(page.locator(".move-playback-counter")).toHaveText("0 / 4");
  await expect(page.locator('.board-shell [data-square="f2"] [data-piece="wP"]')).toHaveCount(1);
  await expect(page.locator('.board-shell [data-square="e7"] [data-piece="bP"]')).toHaveCount(1);
  await expect(first).toBeDisabled();
  await expect(page.getByRole("button", { name: "Previous move", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Next move", exact: true }).click();
  await onMainline(1);
  await expect(first).toBeEnabled();
  await first.click();
  await onMainline(0);
  // Reopening either step of the remembered variation still returns to its branch point.
  for (const row of [0, 1]) {
    await page.locator(".game-variation-row button").nth(row).click();
    await toBranch.click();
    await onMainline(2);
  }
});
