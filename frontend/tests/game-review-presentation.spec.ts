import {test, expect} from '@playwright/test';

test('completed reviews stay move-by-move without a game story or critical-moment surface', async ({page}, info) => {
  test.setTimeout(90_000);
  const {id} = await (await page.request.post(`/__test/game-review-fixture/move-review-${info.project.name}`)).json();
  await page.goto(`/games/${id}`);
  await expect(page.locator('.game-summary > summary')).toContainText('complete game', {timeout: 60_000});
  await expect(page.getByRole('region', {name: 'Game summary'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: /^Jump to/})).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/Game story|Critical moments|Book recognition is not a quality grade/i);
  await expect(page.locator('.coach-speech')).not.toContainText('Review complete.');
  const before = await page.locator('.board-shell').boundingBox();
  const move = page.getByRole('button', {name: '2. g4, Blunder', exact: true});
  await move.click();
  await expect(move).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveURL(/ply=3/);
  expect((await page.locator('.board-shell').boundingBox())!.width).toBe(before!.width);
  await expect(page.locator('.coach-speech')).toContainText(/forced checkmate/i);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(move).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('region', {name: 'Game summary'})).toHaveCount(0);
});

test('a paused partial review keeps its resume control', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/partial-review-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  game.job = {id: 'paused-review', status: 'cancelled', completed: 1, total: 4, error: null, cancel_requested: false};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: 'paused-review', status: 'cancelled'}}));
  await page.goto(`/games/${id}`);
  await expect(page.getByRole('button', {name: 'Resume review'})).toBeVisible();
  await expect(page.getByRole('region', {name: 'Game summary'})).toHaveCount(0);
});
