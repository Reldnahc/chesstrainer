import { test, expect } from '@playwright/test';

test('review both players, follow coach lines, and branch without changing the game', async ({page}, testInfo) => {
  test.setTimeout(90_000);
  if (testInfo.project.name === "desktop") await page.setViewportSize({width: 1366, height: 768});
  const fixture = await page.request.post(`/__test/game-review-fixture/${testInfo.project.name}`);
  expect(fixture.ok()).toBe(true);
  const {id} = await fixture.json();
  await page.goto('/');
  await page.getByRole('button', {name: 'Games', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Your games'})).toBeVisible();
  await page.getByRole('button', {name: new RegExp(`Review-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: 'Start game review', exact: true}).click();
  await expect(page.locator('.game-summary > summary')).toBeVisible({timeout: 60_000});
  await expect(page.getByRole('button', {name: 'Update labels', exact: true})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Game report', exact: true})).toHaveCount(0);
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  expect(game.job.completed).toBe(4);
  if (testInfo.project.name === 'desktop') {
    const board = (await page.locator('.game-board-controls').boundingBox())!;
    const square = (await page.locator('.board-shell').boundingBox())!;
    expect(square.width).toBeGreaterThan(580);
    expect(square.y).toBeLessThan(110);
    const sidebar = (await page.locator('.game-review-sidebar').boundingBox())!;
    expect(sidebar.x).toBeGreaterThan(square.x + square.width);
    await page.setViewportSize({width: 1600, height: 768});
    await expect.poll(async () => (await page.locator('.game-review-sidebar').boundingBox())!.width).toBeGreaterThan(sidebar.width + 200);
    expect(Math.abs((await page.locator('.board-shell').boundingBox())!.width - square.width)).toBeLessThan(2);
    await page.setViewportSize({width: 1366, height: 900});
    await expect.poll(async () => (await page.locator('.board-shell').boundingBox())!.width).toBeGreaterThan(square.width + 100);
    await page.setViewportSize({width: 1366, height: 768});

    await page.screenshot({path: 'test-results/review-compact.png', fullPage: true});
    expect(board.y + board.height).toBeLessThanOrEqual(768);
  }
  await page.evaluate(() => {
    const board = document.querySelector<HTMLElement>('.board-shell')!;
    const observer = new MutationObserver(() => {
      const animated = [...board.querySelectorAll<HTMLElement>('[style]')].some(element =>
        element.style.transition.includes('280ms') && element.style.transform.includes('translate'));
      if (animated) { board.dataset.animationObserved = 'true'; observer.disconnect(); }
    });
    observer.observe(board, {attributes: true, childList: true, subtree: true});
  });
  await page.getByRole('button', {name: 'Last move', exact: true}).click();
  await expect(page.locator('.board-shell')).toHaveAttribute('data-animation-observed', 'true');
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
  await page.getByRole('button', {name: 'Back to game', exact: true}).click();
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
  await page.getByRole('button', {name: 'Previous move', exact: true}).click();
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
  await expect(page.locator('.game-variation-row')).toHaveCount(2); // Coach previews are not saved as user variations.
  await expect(page.locator('.game-speech')).toContainText('Black · Nf6', {timeout: 30_000});
  await expect(page.locator('.game-speech .game-badge')).toBeVisible();
  await expect(page.locator('.game-variation-row .game-badge')).toHaveCount(4, {timeout: 30_000});
  await expect(page.getByLabel(/^Move rating:/)).toBeVisible();
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
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name: 'Back to game', exact: true})).not.toBeVisible();
  await page.getByRole('button', {name: 'Next mistake', exact: true}).click();
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
  expect((await (await page.request.get(`/api/games/${id}`)).json()).frames).toEqual(game.frames);
  await page.getByRole('button', {name: 'All games', exact: true}).click();
  await page.getByRole('button', {name: new RegExp(`Review-${testInfo.project.name} vs CoachFixture`)}).click();
  await expect(page.locator('.game-summary > summary')).toBeVisible();
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


test('coach previews stay short and rapid variation moves finish rating after returning', async ({page}, testInfo) => {
  const response = await page.request.post(`/__test/game-review-fixture/queued-${testInfo.project.name}`);
  const {id} = await response.json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  const frames = game.frames.slice(0, 3).map((f: Record<string, unknown>) => ({...f, annotation: 'Strong reply', highlights: []}));
  // Deliberately long engine output: the UI must expose only the immediate reply.
  const line = {frames: [...frames, ...Array(20).fill(frames[2])], findings: [], material_delta: null, settled: false};
  const seen: string[][] = [];
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/games/*/analyze', async route => {
    const {moves} = route.request().postDataJSON();
    seen.push(moves);
    if (moves.join() === 'd2d4') await gate;
    const san = moves.length === 2 ? 'd5' : moves.length === 1 ? 'd4' : 'f3';
    const candidate = {uci: moves.at(-1) || 'f2f3', san, pv: [], score: {kind: 'cp', value: 0}};
    await route.fulfill({json: {score: null, best_move: null, report: {
      label: moves.length === 2 ? 'Mistake' : 'Good', reason: 'Test reason', coach: 'Test coaching',
      best: candidate, actual: candidate, white_score: candidate.score,
      actual_line: line, best_line: line, depth: 1, engine_version: 'Test engine',
    }}});
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Games', exact: true}).click();
  await page.getByRole('button', {name: new RegExp(`Review-queued-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: '1. f3', exact: true}).click();
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  await expect(page.getByRole('group', {name: 'Coach continuation'}).getByRole('button')).toHaveCount(2);
  await page.getByRole('button', {name: 'Last move', exact: true}).click();
  await expect(page.locator('.game-player').last()).toContainText('white to move');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name: '1. f3', exact: true})).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.game-variation-row')).toHaveCount(0);
  await page.getByRole('button', {name: 'First move', exact: true}).click();
  const square = (name: string) => page.locator(`.board-shell [data-square="${name}"]`);
  await square('d2').click(); await square('d4').click();
  await expect.poll(() => seen.some(moves => moves.join() === 'd2d4')).toBe(true);
  await square('d7').click(); await square('d5').click();
  await expect(page.locator('.game-player').last()).toContainText('white to move');
  await page.keyboard.press('Escape');
  release();
  await expect(page.locator('.game-variation-row .game-badge')).toHaveCount(2);
  await expect(page.locator('.game-variation-row')).toContainText('d4');
  await expect(page.locator('.game-variation-row')).toContainText('Good');
  await expect(page.locator('.game-variation-row')).toContainText('Mistake');
  await expect(page.getByRole('button', {name: 'Back to game', exact: true})).not.toBeVisible();
  await page.locator('.game-variation-row button').last().click();
  await expect(page.locator('.game-speech')).toContainText('Black');
  await expect(page.locator('.game-speech .game-badge')).toHaveText(/Mistake/);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(page.locator('.board-quality')).toHaveCSS('animation-name', 'none');
});
