import { test, expect } from '@playwright/test';

test('review both players, explain in place, and branch without changing the game', async ({page}, testInfo) => {
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
  await expect(page.locator('.game-summary > summary')).toContainText('complete game', {timeout: 60_000});
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
  const coach = (await page.locator('.game-speech').boundingBox())!;
  const notation = (await page.locator('.game-notation').boundingBox())!;
  const notationTop = notation.y + await page.evaluate(() => window.scrollY);
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  await expect(page.locator('.game-speech')).toContainText('Qh4#');
  await expect(page.getByRole('button', {name: 'Hide why', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.board-shell [data-pattern-square="h4"]')).toBeVisible();
  await expect(page.locator('.game-player').last()).toContainText('black to move');
  await expect(page.locator('.game-variation-row')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Back to game', exact: true})).toBeDisabled();
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
  expect((await page.locator('.game-speech').boundingBox())!.height).toBe(coach.height);
  expect((await page.locator('.game-notation').boundingBox())!.y + await page.evaluate(() => window.scrollY)).toBe(notationTop);
  await page.keyboard.press('Escape');
  await expect(page.locator('.board-shell [data-pattern-square]')).toHaveCount(0);
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
  await expect(page.locator('.game-variation-row')).toHaveCount(2);
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
  await expect(page.getByRole('button', {name: 'Back to game', exact: true})).toBeDisabled();
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
  const speechHeight = (await page.locator('.game-speech').boundingBox())!.height;
  const notationTop = (await page.locator('.game-notation').boundingBox())!.y + await page.evaluate(() => window.scrollY);
  release();
  await expect(page.getByText('Engine unavailable at ply 2', {exact: true})).toBeVisible();
  await expect(page.getByText('Engine unavailable at ply 1', {exact: true})).not.toBeVisible();
  expect((await page.locator('.game-speech').boundingBox())!.height).toBe(speechHeight);
  expect((await page.locator('.game-notation').boundingBox())!.y + await page.evaluate(() => window.scrollY)).toBe(notationTop);
  await page.locator('.board-shell [data-square="d2"]').click();
  await expect(page.locator('[data-legal-destination="d4"]')).toBeVisible();
});

test('long coaching and immediate cues keep notation still, and the timeline fills the panel', async ({page}, testInfo) => {
  const response = await page.request.post(`/__test/game-review-fixture/layout-${testInfo.project.name}`);
  const {id} = await response.json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  const longText = 'The pinned knight cannot leave its king exposed, so the bishop can capture its target. '.repeat(14);
  for (let i = 1; i < game.frames.length; i++) {
    const f = game.frames[i];
    const candidate = {uci: f.uci, san: f.san, score: {kind: 'cp', value: i * 100}, pv: []};
    f.report = {label: 'Good', reason: '', coach: i === 1 ? longText : 'A sound move.',
      best: candidate, actual: candidate, white_score: candidate.score, depth: 1, engine_version: 'Layout fixture',
      board_cues: {fen: f.fen, caption: longText, roles: {target: ['e1']}, arrows: [{startSquare: 'h4', endSquare: 'e1', kind: 'threat'}]},
    };
  }
  game.job = {status: 'completed', completed: 4, total: 4};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.goto('/');
  await page.getByRole('button', {name: 'Games', exact: true}).click();
  await page.getByRole('button', {name: new RegExp(`Review-layout-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: '1... e5, Good', exact: true}).click();
  const dimensions = async () => ({
    height: (await page.locator('.game-speech').boundingBox())!.height,
    notationTop: (await page.locator('.game-notation').boundingBox())!.y + await page.evaluate(() => window.scrollY),
    graphTop: (await page.locator('.game-graph').boundingBox())!.y + await page.evaluate(() => window.scrollY),
  });
  const before = await dimensions();
  await page.getByRole('button', {name: '1. f3, Good', exact: true}).click();
  await expect(page.locator('.game-coach-message')).toContainText('pinned knight');
  expect(await dimensions()).toEqual(before);
  expect(await page.locator('.game-coach-message').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  expect(await dimensions()).toEqual(before);
  await page.getByRole('button', {name: 'Flip board', exact: true}).click();
  await expect(page.locator('.board-shell [data-pattern-square="e1"]')).toBeVisible();
  for (const width of testInfo.project.name === 'desktop' ? [1024, 1366, 1920] : [360, 390]) {
    await page.setViewportSize({width, height: testInfo.project.name === 'desktop' ? 768 : 844});
    const graph = await page.locator('.game-graph svg').evaluate(svg => {
      const bounds = svg.getBoundingClientRect();
      const dots = [...svg.querySelectorAll('circle')];
      return {width: bounds.width, right: dots.at(-1)!.getBoundingClientRect().right - bounds.left, height: bounds.height};
    });
    expect(graph.right / graph.width).toBeGreaterThan(.95);
    expect(graph.height).toBe(56);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});


test('explanations never create a move tree and rapid variations finish rating after returning', async ({page}, testInfo) => {
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
      board_cues: {fen: frames[1].fen, caption: 'Black can play e5.', roles: {reply: ['e5']}, arrows: [{startSquare: 'e7', endSquare: 'e5', kind: 'reply'}]},
    }}});
  });
  await page.goto('/');
  await page.getByRole('button', {name: 'Games', exact: true}).click();
  await page.getByRole('button', {name: new RegExp(`Review-queued-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: '1. f3', exact: true}).click();
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  await expect(page.getByRole('group', {name: 'Coach continuation'})).toHaveCount(0);
  await expect(page.locator('.board-shell [data-pattern-square="e5"]')).toBeVisible();
  await expect(page.locator('.game-player').last()).toContainText('black to move');
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
  await expect(page.getByRole('button', {name: 'Back to game', exact: true})).toBeDisabled();
  await page.locator('.game-variation-row button').last().click();
  await expect(page.locator('.game-speech')).toContainText('Black');
  await expect(page.locator('.game-speech .game-badge')).toHaveText(/Mistake/);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(page.locator('.board-quality')).toHaveCSS('animation-name', 'none');
});
