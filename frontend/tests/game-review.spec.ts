import { test, expect } from '@playwright/test';

test('opening starts once, failures allow retry, pause sticks and reopening resumes', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/autostart-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  let starts = 0;
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/analyze`, route => route.fulfill({json: {report: null, score: null, best_move: null}}));
  await page.route(`**/api/games/${id}/review*`, route => {
    if (route.request().method() === 'GET') return route.fulfill({json: {job: game.job, moves: []}});
    starts++;
    if (starts === 1) return route.fulfill({status: 503, json: {detail: 'Temporary engine failure'}});
    game.job = {id: 'auto-review', status: 'queued', completed: 0, total: 4, error: null, cancel_requested: false};
    return route.fulfill({json: {job_id: game.job.id, status: game.job.status}});
  });
  await page.route('**/api/jobs/auto-review/cancel', route => {
    game.job.status = 'cancelled';
    return route.fulfill({json: {ok: true}});
  });
  await page.goto('/games');
  await expect(page.getByRole('heading', {name: 'Your games'})).toBeVisible();
  expect(starts).toBe(0);
  await page.getByRole('link', {name: new RegExp(`Review-autostart-${info.project.name} vs CoachFixture`)}).click();
  await expect(page.getByRole('alert')).toContainText('Temporary engine failure');
  await page.getByRole('button', {name: '1. f3', exact: true}).click();
  expect(starts).toBe(1);
  await page.getByRole('button', {name: 'Retry review', exact: true}).click();
  await page.getByRole('button', {name: 'Pause review', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Resume review', exact: true})).toBeEnabled();
  await page.getByRole('button', {name: 'Next move', exact: true}).click();
  expect(starts).toBe(2);
  await page.reload();
  await expect(page.getByRole('button', {name: 'Pause review', exact: true})).toBeEnabled();
  expect(starts).toBe(3);
});

test('progress merges only new reports without reloading the board or duplicating searches', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/progress-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  // The synthetic +8.25 on the last move scales the graph; a real final checkmate would read M0 instead.
  game.frames.at(-1).termination = null;
  game.frames.at(-1).result = null;
  let fullLoads = 0, analyses = 0;
  const accuracy = {version: 'lichess-2e653ad1-1', white: 86.432, black: 100};
  let finishReview: () => void = () => {};
  const completionGate = new Promise<void>(resolve => { finishReview = resolve; });
  const cursors: number[] = [];
  const moveReport = (ply: number) => {
    const frame = game.frames[ply];
    const candidate = {uci: frame.uci, san: frame.san, pv: [], score: {kind: 'cp', value: ply === 4 ? 825 : 25}};
    return {ply, report: {label: 'Good', reason: '', coach: 'A sound move.', best: candidate, actual: candidate,
      white_score: candidate.score, depth: 16, engine_version: 'Progress fixture', board_cues: null}};
  };
  await page.route(`**/api/games/${id}`, route => { fullLoads++; return route.fulfill({json: game}); });
  await page.route(`**/api/games/${id}/review*`, async route => {
    if (route.request().method() === 'POST') {
      if (game.job?.status === 'completed')
        return route.fulfill({json: {job_id: game.job.id, status: 'completed'}});
      game.job = {id: 'progress-review', status: 'queued', completed: 0, total: 4, error: null, cancel_requested: false};
      return route.fulfill({json: {job_id: game.job.id, status: game.job.status}});
    }
    const after = Number(new URL(route.request().url()).searchParams.get('after_revision'));
    cursors.push(after);
    const plies = after === 0 ? [1] : after === 1 ? [2, 3] : [4];
    // The count may advance between the server's report and count queries.
    const job = {...game.job, status: after === 3 ? 'completed' : 'running', completed: after === 0 ? 2 : plies.at(-1)};
    if (after === 3) {
      await completionGate;
      game.job = job;
      game.accuracy = accuracy;
      for (const ply of [1, 2, 3, 4]) game.frames[ply].report = moveReport(ply).report;
    }
    return route.fulfill({json: {job, revision: plies.at(-1), moves: plies.map(moveReport), accuracy: after === 3 ? accuracy : null}});
  });
  await page.route(`**/api/games/${id}/analyze`, route => {
    analyses++;
    return route.fulfill({json: {report: null, score: null, best_move: null}});
  });
  await page.goto(`/games/${id}?ply=2`);
  const whiteScore = page.getByLabel('White accuracy').locator('b');
  const blackScore = page.getByLabel('Black accuracy').locator('b');
  await expect(whiteScore).toHaveText('—');
  await expect(page.locator('.game-graph-axis')).toHaveText(['+4', '0', '−4']);
  await expect(page.getByLabel('White accuracy')).toHaveAttribute('title', /full game review finishes/);
  await page.getByRole('tab', {name: 'Move quality', exact: true}).click();
  await expect(page.getByLabel('Accuracy for White', {exact: true}).locator('b')).toHaveText('—');
  await expect(page.getByLabel('Accuracy for White', {exact: true})).toHaveAttribute('title', /full game review finishes/);
  await page.getByRole('tab', {name: 'Moves', exact: true}).click();
  // Measure completion at the board, away from the phone's page bottom.
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => document.fonts.ready);
  const boardBefore = await page.locator('.board-shell').boundingBox();
  const readoutBefore = await blackScore.boundingBox();
  finishReview();
  await expect(page.locator('.game-summary caption')).toContainText('Complete game');
  await expect(whiteScore).toHaveText('86.4');
  await expect(blackScore).toHaveText('100.0');
  await expect(page.locator('.game-graph-axis')).toHaveText(['+9', '0', '−9']);
  expect(await page.locator('.board-shell').boundingBox()).toEqual(boardBefore);
  expect(await blackScore.boundingBox()).toEqual(readoutBefore);
  await page.getByRole('tab', {name: 'Move quality', exact: true}).click();
  await expect(page.getByLabel('Accuracy for White', {exact: true}).locator('b')).toHaveText('86.4');
  await expect(page.getByLabel('Accuracy for Black', {exact: true}).locator('b')).toHaveText('100.0');
  await page.getByRole('tab', {name: 'Moves', exact: true}).click();
  await expect(page.getByRole('button', {name: '1... e5, Good', exact: true})).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.game-move-symbol')).toHaveCount(4);
  await page.getByRole('button', {name: 'Start of game', exact: true}).click();
  await expect(page.locator('.move-playback-counter')).toHaveText('0 / 4');
  await expect(page.getByLabel('Evaluation for White: +0.3', {exact: true})).toBeVisible();
  expect(cursors).toEqual([0, 1, 3]);
  expect(fullLoads).toBe(2);
  expect(analyses).toBe(0);
  await page.reload();
  await expect(whiteScore).toHaveText('86.4');
  await expect(blackScore).toHaveText('100.0');
  expect(cursors).toEqual([0, 1, 3]);
  expect(analyses).toBe(0);
});

test('book moves appear on the board, coach and branches with original-game accuracy in move quality', async ({page}, info) => {
  test.setTimeout(90_000);
  const {id} = await (await page.request.post(`/__test/book-review-fixture/${info.project.name}`)).json();
  await page.goto(`/games/${id}?ply=3`);
  await expect(page.locator('.game-summary caption')).toContainText('Complete game', {timeout: 60_000});
  await expect(page.getByRole('button', {name: '2. Ke2, Book', exact: true})).toHaveAttribute('aria-current', 'step');
  // A move shown as Book gets the opening's name, not a correction, even
  // when the engine grades it poorly; quality disclaimers stay out.
  await expect(page.locator('.coach-message')).toContainText('Bongcloud Attack');
  await expect(page.locator('.coach-message')).not.toContainText(/Book recognition|does not.*sound|quality grade/);
  const bookFeedback = await page.locator('.coach-message').innerText();
  await expect(page.locator('.coach-speech .label-book svg')).toBeVisible();
  await expect(page.getByLabel('Move rating: Book')).toBeVisible();
  await expect(page.locator('.board-quality.label-book svg')).toBeVisible();
  const original = await (await page.request.get(`/api/games/${id}`)).json();
  expect(original.frames[3].report.opening.name).toBe('Bongcloud Attack');
  expect(original.frames[3].report.engine_label).not.toBe('Book');
  expect(original.accuracy.white).toBeLessThan(100);
  const white = original.accuracy.white.toFixed(1), black = original.accuracy.black.toFixed(1);
  const board = await page.locator('.board-shell').boundingBox();
  await page.getByRole('tab', {name: 'Move quality', exact: true}).click();
  const table = page.getByRole('table', {name: 'Move quality and accuracy'});
  await expect(table.getByRole('row', {name: '2 Book 1', exact: true})).toBeVisible();
  await expect(page.getByLabel('Accuracy for White', {exact: true}).locator('b')).toHaveText(white);
  await expect(page.getByLabel('Accuracy for Black', {exact: true}).locator('b')).toHaveText(black);
  expect((await page.locator('.board-shell').boundingBox())!.width).toBe(board!.width);
  const counts = await table.locator('tbody tr').allTextContents();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({path: `test-results/book-review-${info.project.name}.png`, fullPage: true});

  await page.getByRole('tab', {name: 'Moves', exact: true}).click();
  await page.getByRole('button', {name: '1... e5, Book', exact: true}).click();
  await expect(page.locator('.coach-avatar')).toHaveAttribute('data-expression', 'book');
  await page.reload();
  await expect(page.locator('.coach-avatar')).toHaveAttribute('data-expression', 'book');
  await page.locator('.board-shell [data-square="g1"]').click();
  await page.locator('.board-shell [data-square="f3"]').click();
  await expect(page.locator('.coach-speech .move-badge')).toContainText('Book', {timeout: 30_000});
  await expect(page.locator('.coach-speech')).toContainText("King's Knight Opening");
  await expect(page.locator('.game-variation-row .label-book svg')).toBeVisible();
  await page.getByRole('tab', {name: 'Move quality', exact: true}).click();
  expect(await table.locator('tbody tr').allTextContents()).toEqual(counts);
  await expect(page.getByLabel('White accuracy', {exact: true}).locator('b')).toHaveText(white);
  await page.getByRole('button', {name: 'Flip board', exact: true}).click();
  await expect(page.getByLabel('Accuracy for White', {exact: true}).locator('b')).toHaveText(white);
  await expect(page.getByLabel('Accuracy for Black', {exact: true}).locator('b')).toHaveText(black);
  await page.getByRole('button', {name: 'Return to game', exact: true}).click();
  await page.getByRole('tab', {name: 'Moves', exact: true}).click();
  await page.getByRole('button', {name: '2. Ke2, Book', exact: true}).click();
  await page.reload();
  await expect(page.locator('.coach-message')).toHaveText(bookFeedback);
  await page.getByRole('tab', {name: 'Move quality', exact: true}).click();
  await expect(page.getByLabel('Accuracy for White', {exact: true}).locator('b')).toHaveText(white);
  await expect(table.getByRole('row', {name: '2 Book 1', exact: true})).toBeVisible();
});

test('review both players, explain in place, and branch without changing the game', async ({page}, testInfo) => {
  test.setTimeout(90_000);
  if (testInfo.project.name === "desktop") await page.setViewportSize({width: 1366, height: 768});
  const fixture = await page.request.post(`/__test/game-review-fixture/${testInfo.project.name}`);
  expect(fixture.ok()).toBe(true);
  const {id} = await fixture.json();
  const starts: string[] = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith(`/games/${id}/review`)) starts.push(request.url()); });
  await page.goto('/');
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Your games'})).toBeVisible();
  await page.getByRole('link', {name: new RegExp(`Review-${testInfo.project.name} vs CoachFixture`)}).click();
  await expect(page.locator('.game-summary caption')).toContainText('Complete game', {timeout: 60_000});
  expect(starts).toHaveLength(1);
  await expect(page.getByRole('button', {name: 'Update labels', exact: true})).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Game report', exact: true})).toHaveCount(0);
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  expect(game.job.completed).toBe(4);
  const whiteScore = page.getByLabel('White accuracy').locator('b');
  const blackScore = page.getByLabel('Black accuracy').locator('b');
  await expect(whiteScore).toHaveText(game.accuracy.white.toFixed(1));
  await expect(blackScore).toHaveText(game.accuracy.black.toFixed(1));
  await page.getByRole('button', {name: 'Flip board', exact: true}).click();
  await expect(page.locator('.game-player').first().getByLabel('White accuracy')).toBeVisible();
  await expect(whiteScore).toHaveText(game.accuracy.white.toFixed(1));
  await page.getByRole('button', {name: 'Flip board', exact: true}).click();
  if (testInfo.project.name === 'desktop') {
    const board = (await page.locator('.game-board-controls').boundingBox())!;
    const square = (await page.locator('.board-shell').boundingBox())!;
    expect(square.width).toBeGreaterThan(580);
    expect(square.y).toBeLessThan(110);
    const sidebar = (await page.locator('.review-sidebar').boundingBox())!;
    expect(sidebar.x).toBeGreaterThan(square.x + square.width);
    await page.setViewportSize({width: 1920, height: 768});
    await expect.poll(async () => (await page.locator('.review-sidebar').boundingBox())!.width).toBeGreaterThan(sidebar.width + 160);
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
  await expect(page.locator('.coach-speech')).toContainText('Blunder');
  await expect(page.locator('.coach-speech')).toContainText(/\bforce(?:d)? (?:check)?mate\b/i);
  await expect(page.locator('.coach-speech')).toContainText('Black');
  await expect(page.locator('.coach-speech')).toContainText('Qh4#');
  const coach = (await page.locator('.coach-speech').boundingBox())!;
  const notation = (await page.locator('.game-notation').boundingBox())!;
  const notationTop = notation.y + await page.evaluate(() => window.scrollY);
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  await expect(page.locator('.coach-speech')).toContainText('Qh4#');
  await expect(page.getByRole('button', {name: 'Hide why', exact: true})).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.board-shell [data-pattern-square="h4"]')).toBeVisible();
  await expect(page.locator('.game-player').last()).toContainText('black to move');
  await expect(page.locator('.game-variation-row')).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Return to game', exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
  expect((await page.locator('.coach-speech').boundingBox())!.height).toBe(coach.height);
  expect((await page.locator('.game-notation').boundingBox())!.y + await page.evaluate(() => window.scrollY)).toBe(notationTop);
  await page.keyboard.press('Escape');
  await expect(page.locator('.board-shell [data-pattern-square]')).toHaveCount(0);
  await page.getByRole('button', {name: 'Previous move', exact: true}).click();
  const square = (name: string) => page.locator(`.board-shell [data-square="${name}"]`);
  await square('e2').click();
  await expect(page.locator('[data-legal-destination="e4"]')).toBeVisible();
  await square('e4').click();
  await expect(page.getByText('Exploring a variation', {exact: true})).toBeVisible();
  await expect(page.locator('.coach-speech')).toContainText('White · e4', {timeout: 30_000});
  await square('b8').click(); await square('c6').click();
  await expect(page.locator('.game-player').last()).toContainText('white to move');
  await page.getByRole('button', {name: 'Previous move', exact: true}).click();
  await expect(page.locator('.game-player').last()).toContainText('black to move');
  await square('g8').click(); await square('f6').click();
  await expect(page.locator('.game-variation-row')).toHaveCount(2);
  await expect(page.locator('.coach-speech')).toContainText('Black · Nf6', {timeout: 30_000});
  await expect(page.locator('.coach-speech .move-badge')).toBeVisible();
  await expect(page.locator('.game-variation-row .move-badge')).toHaveCount(4, {timeout: 30_000});
  await expect(page.getByLabel(/^Move rating:/)).toBeVisible();
  await expect(whiteScore).toHaveText(game.accuracy.white.toFixed(1));
  await expect(blackScore).toHaveText(game.accuracy.black.toFixed(1));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({path: `test-results/game-review-${testInfo.project.name}.png`, fullPage: true});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  if (testInfo.project.name === 'mobile') {
    const boardWidth = (await page.locator('.review-board-row').boundingBox())!.width;
    for (const selector of ['.game-notation', '.game-move-list']) {
      expect((await page.locator(selector).boundingBox())!.width).toBeGreaterThanOrEqual(boardWidth - 2);
    }
    expect((await page.locator('.review-coach').boundingBox())!.y).toBeLessThan((await page.locator('.game-graph').boundingBox())!.y);
  }
  const originalMove = page.locator('.game-graph-node[data-ply="2"]');
  if (testInfo.project.name === 'mobile') await originalMove.tap();
  else await originalMove.click();
  await expect(page.getByRole('button', {name: 'Return to game', exact: true})).toHaveCount(0);
  await expect(page.locator('.game-move-list button[aria-current]')).toHaveAccessibleName(/^1\.\.\. e5/);
  await expect(page).toHaveURL(new RegExp(`/games/${id}\\?ply=2$`));
  await page.getByRole('button', {name: 'Next mistake', exact: true}).click();
  await expect(page.getByRole('button', {name: '2. g4, Blunder', exact: true})).toHaveAttribute('aria-current', 'step');
  expect((await (await page.request.get(`/api/games/${id}`)).json()).frames).toEqual(game.frames);
  await page.getByRole('link', {name: 'All games', exact: true}).click();
  await page.getByRole('link', {name: new RegExp(`Review-${testInfo.project.name} vs CoachFixture`)}).click();
  await expect(page.locator('.game-summary caption')).toHaveText('Complete game');
  await expect(whiteScore).toHaveText(game.accuracy.white.toFixed(1));
  await expect(blackScore).toHaveText(game.accuracy.black.toFixed(1));
  // Reopening checks for newly available human evidence. The idempotent request
  // preserves the completed Stockfish report when no refresh is needed.
  expect(starts).toHaveLength(2);
  expect((await (await page.request.get(`/api/games/${id}`)).json()).frames).toEqual(game.frames);
});

test('refreshing a saved review receives updated evidence from the new job cursor', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/refresh-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  const report = (ply: number, message: string) => {
    const frame = game.frames[ply];
    const candidate = {uci: frame.uci, san: frame.san, pv: [], score: {kind: 'cp', value: 20}};
    return {label: 'Good', engine_label: 'Good', opening: null, reason: '', coach: message,
      best: candidate, actual: candidate, white_score: candidate.score,
      depth: 16, engine_version: 'Refresh fixture', board_cues: null};
  };
  for (let ply = 1; ply < game.frames.length; ply++) game.frames[ply].report = report(ply, 'Previously saved evidence.');
  game.review_revision = 4;
  game.job = {id: 'refresh', status: 'completed', completed: 4, total: 4, error: null, cancel_requested: false};
  const cursors: number[] = [];
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review*`, route => {
    if (route.request().method() === 'POST') {
      game.job = {...game.job, status: 'queued', completed: 0};
      return route.fulfill({json: {job_id: 'refresh', status: 'queued'}});
    }
    cursors.push(Number(new URL(route.request().url()).searchParams.get('after_revision')));
    return route.fulfill({json: {job: {...game.job, status: 'completed', completed: 4}, revision: 8, accuracy: null,
      moves: [1, 2, 3, 4].map(ply => ({ply, report: report(ply, 'Updated saved evidence.')}))}});
  });
  await page.route(`**/api/games/${id}/analyze`, route => route.fulfill({json: {report: null, score: null, best_move: null}}));
  await page.goto(`/games/${id}?ply=1`);
  await expect(page.locator('.coach-speech')).toContainText('Updated saved evidence.');
  expect(cursors[0]).toBe(4);
});

test('refinement continues in the background without progress or moving the selected board', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/refinement-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  for (let ply = 1; ply < game.frames.length; ply++) {
    const frame = game.frames[ply];
    const candidate = {uci: frame.uci, san: frame.san, pv: [], score: {kind: 'cp', value: 20}};
    frame.report = {label: 'Good', engine_label: 'Good', opening: null, reason: '', coach: 'Baseline feedback.',
      best: candidate, actual: candidate, white_score: candidate.score, depth: 16, engine_version: 'Fixture', board_cues: null};
  }
  game.review_revision = 4;
  game.job = {id: 'refinement', status: 'running', phase: 'baseline', completed: 4, total: 4,
    refinement_completed: 0, refinement_total: 1, error: null, cancel_requested: false};
  let beginRefinement = () => {};
  const baselineGate = new Promise<void>(resolve => { beginRefinement = resolve; });
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let polls = 0, analyses = 0;
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review*`, async route => {
    expect(route.request().method()).toBe('GET');
    expect(new URL(route.request().url()).searchParams.get('after_revision')).toBe('4');
    if (++polls === 1) {
      await baselineGate;
      game.job.phase = 'refinement';
      return route.fulfill({json: {revision: 4, job: game.job, moves: [], accuracy: null}});
    }
    await gate;
    const revised = {...game.frames[1].report, label: 'Mistake', engine_label: 'Mistake',
      coach: 'The deeper comparison confirms a concession.', depth: 22};
    return route.fulfill({json: {revision: 6, job: {...game.job, status: 'completed', phase: 'complete', refinement_completed: 1},
      moves: [{ply: 1, report: revised}], accuracy: null}});
  });
  await page.route(`**/api/games/${id}/analyze`, route => {
    analyses++;
    return route.fulfill({json: {report: null, score: null, best_move: null}});
  });
  try {
    await page.goto(`/games/${id}?ply=1`);
    await expect(page.getByRole('progressbar', {name: 'Game review progress'})).toBeVisible();
    beginRefinement();
    await expect(page.getByRole('region', {name: 'Review progress'})).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Pause review', exact: true})).toHaveCount(0);
    await expect(page.locator('.coach-message')).toContainText('Baseline feedback.');
    await page.getByRole('button', {name: 'Next move', exact: true}).click();
    await expect(page.locator('.move-playback-counter')).toHaveText('2 / 4');
    await page.getByRole('button', {name: 'Previous move', exact: true}).click();
    await expect(page.locator('.move-playback-counter')).toHaveText('1 / 4');
    const before = await page.locator('.review-board-square').boundingBox();
    release();
    await expect(page.locator('.coach-message')).toContainText('The deeper comparison confirms a concession.');
    await expect(page.locator('.coach-message')).not.toContainText('Baseline feedback.');
    await expect(page.locator('.game-move-list button[aria-current]')).toHaveAccessibleName('1. f3, Mistake');
    await expect(page).toHaveURL(new RegExp(`/games/${id}\\?ply=1$`));
    await expect(page.getByRole('region', {name: 'Review progress'})).toHaveCount(0);
    expect(await page.locator('.review-board-square').boundingBox()).toEqual(before);
    expect(polls).toBe(2);
    expect(analyses).toBe(0);
    await page.screenshot({path: `test-results/refinement-${info.project.name}.png`, fullPage: true});
  } finally {
    beginRefinement();
    release();
    await page.unrouteAll({behavior: 'wait'});
  }
});

test('dense evaluation dots resize and select the matching ply by pointer and keyboard', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/graph-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  const source = game.frames.slice(1);
  // Repeat display frames to exercise a long timeline without a long engine job.
  const moves = Array.from({length: 120}, (_, index) => {
    const frame = source[index % source.length];
    const candidate = {uci: frame.uci, san: frame.san, score: {kind: 'cp', value: Math.sin(index / 8) * 400}, pv: []};
    return {...frame, termination: null, number: Math.floor(index / 2) + 1, report: {
      label: 'Good', coach: `Coaching for ply ${index + 1}.`, best: candidate, actual: candidate,
      white_score: candidate.score, depth: 1, engine_version: 'Timeline fixture',
    }};
  });
  game.frames = [game.frames[0], ...moves.slice(0, 4)];
  game.job = {status: 'completed', completed: 4, total: 4};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.goto(`/games/${id}?ply=1`);
  await expect(page.locator('.game-graph-node')).toHaveCount(4);
  const dotWidth = () => page.locator('.game-graph-node[data-ply="2"]').evaluate(dot => dot.getBoundingClientRect().width);
  const shortWidth = await dotWidth();
  game.frames = [game.frames[0], ...moves];
  game.job = {status: 'completed', completed: 120, total: 120};
  await page.reload();
  await expect(page.locator('.game-graph-node')).toHaveCount(120);
  await expect.poll(dotWidth).toBeLessThan(shortWidth);
  await page.setViewportSize({width: 1366, height: 768});
  const wideWidth = await dotWidth();
  await page.setViewportSize({width: 360, height: 844});
  await expect.poll(dotWidth).toBeLessThan(wideWidth);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  const dot = (ply: number) => page.locator(`.game-graph-node[data-ply="${ply}"]`);
  if (info.project.name === 'mobile') await dot(99).tap();
  else await dot(99).click();
  await expect(dot(99)).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveURL(new RegExp(`/games/${id}\\?ply=99$`));
  await expect(page.locator('.game-move-list button[aria-current]')).toHaveAccessibleName('50. g4, Good');
  await expect(page.locator('.coach-message')).toContainText('Coaching for ply 99.');
  const utterance = page.locator('.coach-message [data-utterance]');
  const learnerIntent = await utterance.getAttribute('data-intent');
  await page.keyboard.press('ArrowRight');
  await expect(dot(100)).toBeFocused();
  await expect(dot(100)).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveURL(new RegExp(`/games/${id}\\?ply=100$`));
  // Opponent moves keep objective feedback, not the learner's legacy prose.
  await expect(page.locator('.coach-message')).toHaveText(/A sound choice|This remains close/);
  await expect(page.locator('.coach-avatar')).toHaveAttribute('data-expression', 'explaining');
  await expect(utterance).not.toHaveAttribute('data-intent', learnerIntent!);
  const opponentIntent = await utterance.getAttribute('data-intent');
  await page.keyboard.press('Home');
  await expect(dot(1)).toHaveAttribute('aria-current', 'step');
  await page.keyboard.press('End');
  await expect(dot(120)).toHaveAttribute('aria-current', 'step');

  // A tap well above a tiny dot still selects its horizontal position.
  const plot = page.locator('.game-evaluation-plot');
  const target = await dot(60).evaluate(dot => ({x: Number(dot.getAttribute('cx')), y: 2}));
  if (info.project.name === 'mobile') await plot.tap({position: target});
  else await plot.click({position: target});
  await expect(page.locator('.coach-message')).toHaveText(/A sound choice|This remains close/);
  await expect(utterance).not.toHaveAttribute('data-intent', opponentIntent!);
  await expect(dot(60)).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.move-playback-counter')).toHaveText('60 / 120');
  await expect(page.getByText('Review tools & details', {exact: true})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Find training mistakes'})).toHaveCount(0);
  await page.screenshot({path: `test-results/evaluation-dense-${info.project.name}.png`, fullPage: true});
});

test('stale engine responses never replace the selected move and failures remain playable', async ({page}, testInfo) => {
  await page.route('**/api/games/*/review', route => route.fulfill({status: 503, json: {detail: 'Review unavailable in this failure fixture'}}));
  await page.request.post(`/__test/game-review-fixture/stale-${testInfo.project.name}`);
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/games/*/analyze', async route => {
    const body = route.request().postDataJSON();
    if (body.ply === 1) await gate;
    await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({detail: `Engine unavailable at ply ${body.ply}`})});
  });
  await page.goto('/');
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  await page.getByRole('link', {name: new RegExp(`Review-stale-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: '1. f3', exact: true}).click();
  await page.waitForRequest(r => r.url().endsWith('/analyze') && r.postDataJSON().ply === 1);
  await page.getByRole('button', {name: '1... e5', exact: true}).click();
  const speechHeight = (await page.locator('.coach-speech').boundingBox())!.height;
  const notationTop = (await page.locator('.game-notation').boundingBox())!.y + await page.evaluate(() => window.scrollY);
  release();
  await expect(page.getByText('Engine unavailable at ply 2', {exact: true})).toBeVisible();
  await expect(page.getByText('Engine unavailable at ply 1', {exact: true})).not.toBeVisible();
  await expect(page.locator('.review-coach .coach-avatar')).toHaveAttribute('data-expression', 'uncertain');
  expect((await page.locator('.coach-speech').boundingBox())!.height).toBe(speechHeight);
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
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  await page.getByRole('link', {name: new RegExp(`Review-layout-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: '1... e5, Good', exact: true}).click();
  const dimensions = async () => ({
    height: (await page.locator('.coach-speech').boundingBox())!.height,
    notationTop: (await page.locator('.game-notation').boundingBox())!.y + await page.evaluate(() => window.scrollY),
    graphTop: (await page.locator('.game-graph').boundingBox())!.y + await page.evaluate(() => window.scrollY),
  });
  const before = await dimensions();
  await page.getByRole('button', {name: '1. f3, Good', exact: true}).click();
  await expect(page.locator('.coach-message')).toContainText('pinned knight');
  expect(await dimensions()).toEqual(before);
  expect(await page.locator('.coach-message').evaluate(el => el.scrollHeight > el.clientHeight)).toBe(true);
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  expect(await dimensions()).toEqual(before);
  await page.getByRole('button', {name: 'Flip board', exact: true}).click();
  await expect(page.locator('.board-shell [data-pattern-square="e1"]')).toBeVisible();
  for (const width of testInfo.project.name === 'desktop' ? [1024, 1366, 1920] : [360, 390]) {
    await page.setViewportSize({width, height: testInfo.project.name === 'desktop' ? 768 : 844});
    const graph = await page.locator('.game-evaluation-plot').evaluate((svg, lastPly) => {
      const bounds = svg.getBoundingClientRect();
      const last = svg.querySelector(`[data-ply="${lastPly}"]`)!;
      return {width: bounds.width, right: last.getBoundingClientRect().right - bounds.left, height: bounds.height};
    }, game.frames.length - 1);
    expect(graph.right / graph.width).toBeGreaterThan(.95);
    expect(graph.height).toBe(120);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
});


test('explanations never create a move tree and rapid variations finish rating after returning', async ({page}, testInfo) => {
  await page.route('**/api/games/*/review', route => route.fulfill({status: 503, json: {detail: 'Review unavailable in this variation fixture'}}));
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
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  await page.getByRole('link', {name: new RegExp(`Review-queued-${testInfo.project.name} vs CoachFixture`)}).click();
  await page.getByRole('button', {name: '1. f3', exact: true}).click();
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  await expect(page.getByRole('group', {name: 'Coach continuation'})).toHaveCount(0);
  await expect(page.locator('.board-shell [data-pattern-square="e5"]')).toBeVisible();
  await expect(page.locator('.game-player').last()).toContainText('black to move');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', {name: '1. f3', exact: true})).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('.game-variation-row')).toHaveCount(0);
  await page.getByRole('button', {name: 'Previous move', exact: true}).click();
  const square = (name: string) => page.locator(`.board-shell [data-square="${name}"]`);
  await square('d2').click(); await square('d4').click();
  await expect.poll(() => seen.some(moves => moves.join() === 'd2d4')).toBe(true);
  await square('d7').click(); await square('d5').click();
  await expect(page.locator('.game-player').last()).toContainText('white to move');
  await page.keyboard.press('Escape');
  release();
  await expect(page.locator('.game-variation-row .move-badge')).toHaveCount(2);
  await expect(page.locator('.game-variation-row')).toContainText('d4');
  await expect(page.locator('.game-variation-row')).toContainText('Good');
  await expect(page.locator('.game-variation-row')).toContainText('Mistake');
  await expect(page.getByRole('button', {name: 'Return to game', exact: true})).toHaveCount(0);
  await page.locator('.game-variation-row button').last().click();
  await expect(page.locator('.coach-speech')).toContainText('Black');
  await expect(page.locator('.coach-speech .move-badge')).toHaveText(/Mistake/);
  await page.emulateMedia({reducedMotion: 'reduce'});
  await expect(page.locator('.board-quality')).toHaveCSS('animation-name', 'none');
});
