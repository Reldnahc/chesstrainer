import {test, expect} from '@playwright/test';

test('completed review has factual key moments, working jumps and stable board geometry', async ({page}, info) => {
  test.setTimeout(90_000);
  const {id} = await (await page.request.post(`/__test/game-review-fixture/story-${info.project.name}`)).json();
  await page.goto(`/games/${id}`);
  await expect(page.getByRole('region', {name: 'Game summary'})).toBeVisible({timeout: 60_000});
  const story = page.getByRole('region', {name: 'Game summary'});
  await expect(story).toContainText('Black won by checkmate.');
  await expect(page.locator('.coach-speech')).toContainText('Review complete.');
  const before = await page.locator('.board-shell').boundingBox();
  const jumps = story.getByRole('button', {name: /^Jump to/});
  expect(await jumps.count()).toBeGreaterThanOrEqual(2);
  expect(await jumps.count()).toBeLessThanOrEqual(4);
  await story.getByRole('button', {name: 'Jump to 2. g4: Turning point'}).click();
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveURL(/ply=3/);
  expect((await page.locator('.board-shell').boundingBox())!.width).toBe(before!.width);
  await story.locator('summary').click();
  await expect(story).toContainText('forced-mate transition');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/game-story-${info.project.name}.png`, fullPage: true});
  await page.reload();
  await expect(story).toContainText('Black won by checkmate.');
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
});

test('a paused partial review does not claim completion', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/partial-story-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  game.job = {id: 'paused-story', status: 'cancelled', completed: 1, total: 4, error: null, cancel_requested: false};
  game.narrative = {...game.narrative, complete: false};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: 'paused-story', status: 'cancelled'}}));
  await page.goto(`/games/${id}`);
  await expect(page.getByRole('button', {name: 'Resume review'})).toBeVisible();
  await expect(page.getByRole('region', {name: 'Game summary'})).toHaveCount(0);
});
