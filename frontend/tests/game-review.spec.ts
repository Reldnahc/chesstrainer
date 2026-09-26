import { test, expect } from '@playwright/test';

test('review both players, follow coach lines, and branch without changing the game', async ({page}, testInfo) => {
  test.setTimeout(90_000);
  const fixture = await page.request.post(`/__test/game-review-fixture/${testInfo.project.name}`);
  expect(fixture.ok()).toBe(true);
  const {id} = await fixture.json();
  await page.goto('/');
  await page.getByRole('button', {name: 'Games', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Your games'})).toBeVisible();
  await page.getByRole('button', {name: new RegExp(`Review-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: 'Start game review', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Update labels', exact: true})).toBeVisible({timeout: 60_000});
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  expect(game.job.completed).toBe(4);
  await page.getByRole('button', {name: 'Last move', exact: true}).click();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  await expect(page.locator('.game-speech')).toContainText('Blunder');
  await expect(page.locator('.game-speech')).toContainText('forced checkmate');
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  await expect(page.getByText('Played-move line', {exact: false})).toBeVisible();
  await page.getByRole('button', {name: 'Last move', exact: true}).click();
  await expect(page.locator('.game-player').last()).toContainText('checkmate');
  await page.getByRole('button', {name: 'Return to game', exact: true}).click();
  await expect(page.getByRole('button', {name: '1... e5', exact: false})).toHaveAttribute('aria-current', 'step');
  const square = (name: string) => page.locator(`.board-shell [data-square="${name}"]`);
  await square('e2').click();
  await expect(page.locator('[data-legal-destination="e4"]')).toBeVisible();
  await square('e4').click();
  await expect(page.getByText('Exploring a variation', {exact: true})).toBeVisible();
  await expect(page.locator('.game-speech')).toContainText('White · e4', {timeout: 30_000});
  await square('b8').click(); await square('c6').click();
  await expect(page.locator('.game-player').last()).toContainText('white to move');
  await page.getByRole('button', {name: 'Previous move', exact: true}).click();
  await expect(page.locator('.game-player').last()).toContainText('black to move');
  await square('g8').click(); await square('f6').click();
  await expect(page.locator('.game-variation-row')).toHaveCount(3); // Suggested line + two user branches.
  await expect(page.locator('.game-speech')).toContainText('Black · Nf6', {timeout: 30_000});
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path: `test-results/game-review-${testInfo.project.name}.png`, fullPage: true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name === 'mobile') {
    const boardWidth = (await page.locator('.game-board-with-eval').boundingBox())!.width;
    for (const selector of ['.game-progress', '.game-move-list']) {
      expect((await page.locator(selector).boundingBox())!.width).toBeGreaterThanOrEqual(boardWidth - 2);
    }
    expect((await page.locator('.game-coach').boundingBox())!.y).toBeLessThan((await page.locator('.game-graph').boundingBox())!.y);
  }
  await page.getByRole('button', {name: 'Return to game', exact: true}).click();
  await page.getByRole('button', {name: 'Next mistake', exact: true}).click();
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
  expect((await (await page.request.get(`/api/games/${id}`)).json()).frames).toEqual(game.frames);
  await page.getByRole('button', {name: 'All games', exact: true}).click();
  await page.getByRole('button', {name: new RegExp(`Review-${testInfo.project.name} vs CoachFixture`)}).click();
  await expect(page.getByRole('button', {name: 'Update labels', exact: true})).toBeVisible();
});

test('stale engine responses never replace the selected move and failures remain playable', async ({page}, testInfo) => {
  await page.request.post(`/__test/game-review-fixture/stale-${testInfo.project.name}`);
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/games/*/analyze', async route => {
    const body = route.request().postDataJSON();
    if (body.ply === 1) await gate;
    await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({detail: `Engine unavailable at ply ${body.ply}`})});
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Games', exact: true}).click();
  await page.getByRole('button', {name: new RegExp(`Review-stale-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: '1. f3', exact: true}).click();
  await page.waitForRequest(r => r.url().endsWith('/analyze') && r.postDataJSON().ply === 1);
  await page.getByRole('button', {name: '1... e5', exact: true}).click();
  release();
  await expect(page.getByText('Engine unavailable at ply 2', {exact: true})).toBeVisible();
  await expect(page.getByText('Engine unavailable at ply 1', {exact: true})).not.toBeVisible();
  await page.locator('.board-shell [data-square="d2"]').click();
  await expect(page.locator('[data-legal-destination="d4"]')).toBeVisible();
});
