import { test, expect, type Locator } from '@playwright/test';

// Mobile review scrolls naturally; compare document geometry across feedback,
// independently of the scrolling needed to tap an action beneath the board.
const documentBox = (locator: Locator) => locator.evaluate(element => {
  const {x, y, width, height} = element.getBoundingClientRect();
  return {x: x + scrollX, y: y + scrollY, width, height};
});

test('redesigned screens fit the viewport and load local fonts and favicon', async ({page}, testInfo) => {
  await page.goto('/study/due');
  await expect(page.getByRole('heading', {name: 'Your move.'})).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('14px "IBM Plex Sans"'))).toBe(true);
  const icon = await page.locator('link[rel="icon"]').getAttribute('href');
  const response = await page.request.get(icon!);
  expect(response.headers()['content-type']).toContain('image/svg+xml');
  expect(await response.text()).toContain('<svg');
  for (const tab of ['Study', 'Games', 'Weaknesses', 'Settings']) {
    await page.getByRole('link', {name: tab, exact: true}).click();
    await expect(page.getByRole('link', {name: tab, exact: true})).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('main h1')).toBeVisible();
    if (tab === 'Settings') {
      await expect(page.getByRole('region', {name: 'Recent Chess.com games', exact: true})).toBeVisible();
      await page.getByRole('navigation', {name: 'Settings sections'}).getByRole('link', {name: 'Advanced', exact: true}).click();
      await expect(page.getByRole('heading', {name: 'Training tools', exact: true})).toBeVisible();
      const source = page.getByRole('link', {name: 'Download source code'});
      await expect(source).toHaveAttribute('href', '/assets/fieldwork-source.zip');
      const download = await page.request.get((await source.getAttribute('href'))!);
      expect(download.ok()).toBe(true);
      // Windows' MIME registry also uses application/x-zip-compressed.
      expect(download.headers()['content-type']).toMatch(/^application\/(?:zip|x-zip-compressed)(?:;|$)/);
      expect((await download.body()).subarray(0, 2).toString()).toBe('PK');
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/redesign-${testInfo.project.name}-${tab.toLowerCase()}.png`, fullPage: true});
  }
});

test('create a curated position, fail once, solve by tapping and retain after reload', async ({page}, testInfo) => {
  await page.goto('/study/due');
  await expect(page.getByRole('heading', {name: 'Your move.'})).toBeVisible();
  const savedPosition = await page.request.post('/api/exercises/manual', {data: {
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: [testInfo.project.name === 'mobile' ? 'd2d4' : 'e2e4'],
  }});
  expect(savedPosition.ok()).toBe(true);
  const exerciseId = (await savedPosition.json()).id;
  await page.goto(`/?exercise=${exerciseId}`);
  await expect(page.getByRole('heading', {name: 'Find a good move.'})).toBeVisible();
  await expect(page.getByText('Also accepted:', {exact: false})).not.toBeVisible();
  await page.screenshot({path: `test-results/${testInfo.project.name}-review.png`, fullPage: true});
  const board = page.locator('.board-shell');
  const square = (name: string) => board.locator(`[data-square="${name}"]`);
  const markers = board.locator('[data-legal-destination]');
  await square('e2').click();
  await expect(square('e2').locator('.board-square-content')).toHaveCSS('background-color', 'rgb(233, 165, 105)');
  await expect(markers).toHaveCount(2);
  await expect(board.locator('[data-legal-destination="e4"]')).toBeVisible();
  await square('e2').click();
  await expect(markers).toHaveCount(0);
  await square('e2').click(); await square('d2').click();
  await expect(board.locator('[data-legal-destination="d4"]')).toBeVisible();
  await expect(board.locator('[data-legal-destination="e4"]')).toHaveCount(0);
  await square('d5').click();
  await expect(markers).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Reveal move'})).toBeVisible();
  await square('g1').click(); await square('f3').click();
  await expect(page.locator('.move-status.retry')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Reveal move'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Find a good move.'})).toBeVisible();
  const file = testInfo.project.name === 'mobile' ? 'd' : 'e';
  await square(`${file}2`).click(); await square(`${file}4`).click();
  await expect(page.getByRole('status').filter({hasText: 'This recall stays marked for relearning.'})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText: 'Progress saved.'})).toContainText('Next review:');
  expect(new URL(page.url()).searchParams.has('exercise')).toBe(false);
  const nextQueue = page.waitForResponse(r => r.url().includes('/api/review/queue'));
  await page.reload();
  expect((await (await nextQueue).json()).map((item: {exercise_id: string}) => item.exercise_id)).not.toContain(exerciseId);
  await expect(page.getByRole('status').filter({hasText: 'This recall stays marked for relearning.'})).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('PGN upload form imports a learner game and reports real analysis', async ({page}, testInfo) => {
  await page.goto('/');
  await page.getByRole('link', {name: 'Settings', exact: true}).click();
  await page.getByRole('button', {name: 'Import PGN', exact: true}).click();
  await page.getByRole('button', {name: 'Paste PGN text', exact: true}).click();
  await page.getByLabel('PGN', {exact: true}).fill(`[Round "${testInfo.project.name}"]\n[White "UI learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1`);
  await page.getByLabel('Your username(s)').fill('UI learner');
  await page.getByRole('checkbox', {name: 'Also analyze these games for training'}).check();
  await page.getByRole('button', {name: 'Import & analyze games', exact: true}).click();
  await expect(page.locator('.import-form').getByRole('status')).toContainText(/imported/);
  await expect(page.locator('.job .badge').first()).toHaveText('completed', {timeout: 30000});
  await expect(page.locator('.job').first()).toContainText('2 decisions');
  const previousJobs = await page.locator('.job').count();
  await page.getByRole('checkbox', {name: 'Also analyze these games for training'}).check();
  await page.getByRole('button', {name: 'Import & analyze games', exact: true}).click();
  await expect(page.locator('.import-form').getByRole('status')).toContainText('0 imported');
  await expect(page.locator('.import-form').getByRole('status')).toContainText('1 duplicate');
  await expect(page.locator('.job')).toHaveCount(previousJobs);
});

test('promotion choice and drag interaction are graded by the backend', async ({page}, testInfo) => {
  await page.goto('/');
  const saved = await page.request.post('/api/exercises/manual', {data: {
    fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1', moves: ['a7a8n'],
  }});
  expect(saved.ok()).toBe(true);
  const id = (await saved.json()).id;
  await page.goto('/?exercise=' + id);
  await expect(page.getByRole('heading', {name: 'Find a good move.'})).toBeVisible();
  const board = page.locator('.board-shell');
  const source = board.locator('[data-square="a7"]');
  const target = board.locator('[data-square="a8"]');
  if (testInfo.project.name === 'desktop') {
    const from = await source.boundingBox(), to = await target.boundingBox();
    await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
    await page.mouse.down();
    await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, {steps: 12});
    await expect(board.locator('[data-legal-destination="a8"]')).toBeVisible();
    await page.mouse.up();
  } else {
    await source.tap(); await target.tap();
  }
  await expect(page.getByRole('dialog', {name: 'Choose promotion'})).toBeVisible();
  await page.getByRole('button', {name: 'Knight', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Good decision.', exact: true})).toBeVisible();
  await expect(page.getByText('a8=N', {exact: true})).toBeVisible();
});

test('legal capture rings exclude pinned moves and stay usable after a failed answer', async ({page}, testInfo) => {
  await page.goto('/');
  const response = await page.request.post('/api/exercises/manual', {data: {
    fen: 'k3r3/8/8/8/8/8/4R3/4K3 w - - 0 1', moves: ['e2e8'],
  }});
  const {id} = await response.json();
  await page.goto(`/?exercise=${id}`);
  const board = page.locator('.board-shell');
  const square = (name: string) => board.locator(`[data-square="${name}"]`);
  await square('e2').click();
  await expect(board.locator('[data-legal-destination="e8"].capture')).toBeVisible();
  await expect(board.locator('[data-legal-destination="e3"].quiet')).toBeVisible();
  await expect(board.locator('[data-legal-destination="d2"]')).toHaveCount(0);
  await page.screenshot({path: `test-results/${testInfo.project.name}-legal-moves.png`, fullPage: true});
  await square('e3').click();
  await expect(page.locator('.move-status.retry')).toBeVisible();
  await expect(board.locator('[data-legal-destination]')).toHaveCount(0);
  await square('e2').click();
  await expect(board.locator('[data-legal-destination="e8"].capture')).toBeVisible();
  await square('e8').click();
  await expect(page.getByRole('status').filter({hasText: 'This recall stays marked for relearning.'})).toBeVisible();
  await expect(board.locator('[data-legal-destination]')).toHaveCount(0);
});

test('Chess.com username import fetches, analyzes and deduplicates without OpenAI', async ({page}, testInfo) => {
  const username = `ui-import-${testInfo.project.name}`;
  await page.goto('/');
  await page.getByRole('link', {name: 'Settings', exact: true}).click();
  await page.getByRole('region', {name: 'Recent Chess.com games', exact: true}).getByRole('button', {name: 'Import older games', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Import from Chess.com'})).toBeVisible();
  await expect(page.getByLabel('Time control', {exact: true})).toHaveValue('rapid');
  await expect(page.getByLabel('Look back')).toHaveValue('3');
  await expect(page.getByLabel('Maximum new games')).toHaveValue('100');
  await page.getByLabel('Chess.com username', {exact: true}).fill(username);
  await page.getByLabel('Look back').selectOption('6');
  await page.getByLabel('Maximum new games').fill('25');
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = endDate.slice(0, 7) + '-01';
  await page.getByText('Custom date range', {exact: true}).click();
  await page.getByLabel('From date').fill(startDate);
  await page.getByLabel('To date').fill(endDate);
  await expect(page.getByLabel('Look back')).toBeDisabled();
  const queued = page.waitForResponse(r => r.url().endsWith('/api/imports/provider/chesscom') && r.request().method() === 'POST');
  await page.getByRole('checkbox', {name: 'Also analyze these games for training'}).check();
  await page.getByRole('button', {name: 'Import & analyze games', exact: true}).click();
  const response = await queued;
  expect(response.status()).toBe(202);
  expect(response.request().postDataJSON()).toEqual({username, analyze: true, time_class: 'rapid', months: 6, max_games: 25, start_date: startDate, end_date: endDate});
  await expect(page.locator('.import-form').getByRole('status')).toContainText('Import queued');
  const job = page.locator('.job').filter({hasText: username}).first();
  await expect(job.locator('.badge')).toHaveText('completed', {timeout: 30000});
  await expect(job).toContainText('1 imported');
  await expect(job).toContainText('2 decisions');
  await page.screenshot({path: `test-results/${testInfo.project.name}-chesscom-import.png`, fullPage: true});
  await page.getByRole('checkbox', {name: 'Also analyze these games for training'}).check();
  await page.getByRole('button', {name: 'Import & analyze games', exact: true}).click();
  await expect(job).toContainText('0 imported · 1 duplicates', {timeout: 30000});
  await expect(job.locator('.badge')).toHaveText('completed', {timeout: 30000});
  await expect(job).toContainText('0 / 0 games');
  await expect(job).toContainText('No new games found');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Chess.com missing username reports a retryable provider error', async ({page}) => {
  await page.goto('/');
  await page.getByRole('link', {name: 'Settings', exact: true}).click();
  await page.getByRole('region', {name: 'Recent Chess.com games', exact: true}).getByRole('button', {name: 'Import older games', exact: true}).click();
  await page.getByLabel('Chess.com username', {exact: true}).fill('missing-player');
  await page.getByRole('checkbox', {name: 'Also analyze these games for training'}).check();
  await page.getByRole('button', {name: 'Import & analyze games', exact: true}).click();
  const job = page.locator('.job').filter({hasText: 'missing-player'}).first();
  await expect(job.locator('.badge')).toHaveText('failed', {timeout: 10000});
  await job.locator('summary').first().click();
  await expect(job).toContainText('not found');
  await expect(job.getByRole('button', {name: 'Retry saved work'})).toBeVisible();
});


test('removed lesson links return to Study without starting a lesson', async ({page}) => {
  const requests: string[] = [];
  page.on('request', request => {if (request.url().includes('/api/course')) requests.push(request.url());});
  await page.goto('/?unit=archived-unit');
  await expect(page).toHaveURL('/study');
  await expect(page.locator('main h1')).toBeVisible();
  await expect(page.getByRole('navigation', {name: 'Main navigation'}).getByRole('link')).toHaveText(['Study', 'Games', 'Weaknesses', 'Settings']);
  await expect(page.getByRole('button', {name: 'Course', exact: true})).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has('unit')).toBe(false);
  expect(requests).toEqual([]);
  await expect(page.getByRole('button', {name: 'Repertoire', exact: true})).toHaveCount(0);
  await expect(page.getByText('Add a manual position', {exact: true})).toHaveCount(0);
  expect((await page.request.get('/api/repertoires')).status()).toBe(410);
  expect((await page.request.post('/api/repertoires')).status()).toBe(410);
  expect((await page.request.post('/api/course/rebuild')).status()).toBe(410);
});


test('phone reviews keep a full-width board and reachable actions through retries and details', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile', 'Phone viewport regression');
  for (const size of [{width: 390, height: 700}, {width: 375, height: 600}, {width: 360, height: 640}]) {
    await page.setViewportSize(size);
    const response = await page.request.post('/api/exercises/manual', {data: {
      fen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', moves: ['e2e4'],
      explanation: 'A detailed explanation. '.repeat(60),
    }});
    const {id} = await response.json();
    await page.goto(`/?exercise=${id}`);
    const board = page.locator('.board-shell');
    const square = (name: string) => board.locator(`[data-square="${name}"]`);
    const fits = async (action: string) => {
      const button = page.getByRole('button', {name: action, exact: true});
      await button.evaluate(element => element.scrollIntoView({block: 'center'}));
      await expect(button).toBeInViewport({ratio: 1});
      await board.scrollIntoViewIfNeeded();
      await expect(board).toBeInViewport({ratio: 1});
      expect((await documentBox(board)).width).toBeGreaterThan(size.width - 60);
      await page.evaluate(() => window.scrollTo(0, 0));
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    };
    await fits('Reveal move');
    await square('e2').tap(); await square('e3').tap();
    await expect(page.locator('.move-status.retry')).toBeVisible();
    await fits('Reveal move');
    await square('e2').tap(); await square('e4').tap();
    await expect(page.getByRole('button', {name: 'Next position', exact: true})).toBeVisible();
    await fits('Next position');
    await page.screenshot({path: `test-results/review-phone-${size.width}-${size.height}.png`});
    await page.getByText('Answer & review details', {exact: true}).click();
    await expect(page.getByText('A detailed explanation.', {exact: false})).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.getByRole('button', {name: 'Next position', exact: true}).click();
    await expect(page.locator('.load-state')).toHaveCount(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  }
});


test('retired review feedback replaces the next due date', async ({page}) => {
  const response = await page.request.post('/api/exercises/manual', {data: {
    fen: '4k3/8/8/8/8/8/4P3/3K4 w - - 0 1', moves: ['e2e4'],
  }});
  const {id} = await response.json();
  // Contract-only UI fixture; backend retirement is tested through persisted API recalls.
  await page.route('**/api/review/sessions/*/move', async route => {
    const response = await route.fetch();
    const result = await response.json();
    await route.fulfill({response, json: {...result, retired: true, retired_interval_days: 163, next_due: null}});
  });
  await page.goto(`/?exercise=${id}`);
  const board = page.locator('.board-shell');
  await board.locator('[data-square="e2"]').click();
  await board.locator('[data-square="e4"]').click();
  await expect(page.getByRole('heading', {name: 'Position retired.'})).toBeVisible();
  await expect(page.getByRole('status').filter({hasText: 'Progress saved.'})).toContainText('Retired from future reviews.');
  await expect(page.getByText('Next review:', {exact: false})).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Next position'})).toBeVisible();
});


test('wrong-answer feedback stays steady while checking and retrying', async ({page}, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({width: 375, height: 600});
  const response = await page.request.post('/api/exercises/manual', {data: {
    fen: '3k4/8/8/8/8/8/4P3/4K3 w - - 0 1', moves: ['e2e4'],
  }});
  const {id} = await response.json();
  let release = () => {};
  let requested = () => {};
  let gate = Promise.resolve();
  let arrived = Promise.resolve();
  function hold() {
    gate = new Promise<void>(resolve => {release = resolve;});
    arrived = new Promise<void>(resolve => {requested = resolve;});
  }
  await page.route('**/api/review/sessions/*/move', async route => {
    const response = await route.fetch();
    requested();
    await gate;
    await route.fulfill({response});
  });
  await page.goto(`/?exercise=${id}`);
  const board = page.locator('.board-shell');
  const action = page.getByRole('button', {name: 'Reveal move', exact: true});
  await expect(action).toBeEnabled();
  const baseline = await documentBox(action);
  const originalBoard = await documentBox(board);
  const beforeReviews = (await (await page.request.get('/api/stats')).json()).reviews;
  await expect(board).toHaveCSS('outline-style', 'none');
  for (let attempt = 0; attempt < 2; attempt++) {
    hold();
    await board.locator('[data-square="e2"]').click();
    await board.locator('[data-square="e3"]').click();
    await arrived;
    try {
      await expect(page.getByRole('status').filter({hasText: 'Checking your move'})).toBeVisible();
      await expect(board).toHaveCSS('outline-style', 'none');
      expect((await documentBox(action))!.y).toBeCloseTo(baseline!.y, 0);
      await expect(page.locator('.move-status.retry')).toHaveCount(0);
      if (testInfo.project.name === 'mobile') {
        await board.scrollIntoViewIfNeeded();
        await expect(board).toBeInViewport({ratio: 1});
      }
    } finally {release();}
    await expect(action).toBeEnabled();
    await expect(page.locator('.move-status.retry')).toBeVisible();
    await expect(page.locator('.move-status.retry')).not.toContainText('Checking your move');
    await expect(board).toHaveCSS('outline-color', 'rgb(255, 98, 120)');
    await expect(board).toHaveCSS('outline-width', '3px');
    expect(await documentBox(board)).toEqual(originalBoard);
    expect(await board.evaluate(element => getComputedStyle(element, '::after').pointerEvents)).toBe('none');
    expect((await documentBox(action))!.y).toBeCloseTo(baseline!.y, 0);
    await expect(board.locator('[data-square="e2"] [data-piece="wP"]')).toBeVisible();
    await expect(board.locator('[data-square="e3"] [data-piece="wP"]')).toHaveCount(0);
  }
  await page.screenshot({path: `test-results/wrong-answer-stable-${testInfo.project.name}.png`});
  await board.locator('[data-square="e2"]').click();
  await board.locator('[data-square="e4"]').click();
  await expect(page.getByRole('heading', {name: 'Good decision.'})).toBeVisible();
  await expect(board).toHaveCSS('outline-style', 'none');
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(beforeReviews + 1);
});


test('fast wrong answers never flash a loading message', async ({page}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const response = await page.request.post('/api/exercises/manual', {data: {
    fen: '2k5/8/8/8/8/8/4P3/4K3 w - - 0 1', moves: ['e2e4'],
  }});
  const {id} = await response.json();
  await page.goto(`/?exercise=${id}`);
  const board = page.locator('.board-shell');
  const action = page.getByRole('button', {name: 'Reveal move', exact: true});
  await expect(action).toBeEnabled();
  await page.evaluate(() => {
    const seen: string[] = [];
    const target = document.querySelector('.practice-panel')!;
    new MutationObserver(() => seen.push(target.textContent || '')).observe(target, {childList: true, subtree: true, characterData: true});
    (window as unknown as {feedbackSeen: string[]}).feedbackSeen = seen;
  });
  await board.locator('[data-square="e2"]').click();
  await board.locator('[data-square="e3"]').click();
  await expect(page.locator('.move-status.retry')).toBeVisible();
  await expect(action).toBeEnabled();
  // Let any mistakenly surviving loading timer fire after the response.
  await page.clock.runFor(500);
  expect(await page.evaluate(() => (window as unknown as {feedbackSeen: string[]}).feedbackSeen.some(text => text.includes('Checking your move')))).toBe(false);
  await expect(page.locator('.move-status.retry')).toBeVisible();
});


test('review explanations replay the submitted move and return without another recall', async ({page}, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({width: 375, height: 600});
  const fixture = await (await page.request.post(`/__test/review-explanation-fixture/playback-${testInfo.project.name}`)).json();
  const before = await (await page.request.get('/api/stats')).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  const board = page.locator('main .board-shell');
  const play = async (uci: string) => {
    await board.locator(`[data-square="${uci.slice(0,2)}"]`).click();
    await board.locator(`[data-square="${uci.slice(2,4)}"]`).click();
  };
  await expect(page.getByRole('button', {name: "Show me why"})).toBeDisabled();
  await play(fixture.wrong);
  await expect(page.getByRole('heading', {name: 'Mistake.', exact: true})).toBeVisible();
  await expect(board.locator('[data-square="a1"] [data-piece="bQ"]')).toBeVisible();
  await expect(board.locator('[data-square="a1"] [data-piece="wR"]')).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Try again', exact:true})).toBeVisible();
  await expect(page.getByRole('button', {name:'Show me why', exact:true})).toBeVisible();
  await expect(board).toHaveCSS('outline-color', 'rgb(255, 98, 120)');
  await page.screenshot({path:`test-results/counter-reply-${testInfo.project.name}.png`});
  await page.getByRole('button', {name:'Try again', exact:true}).click();
  await expect(board).toHaveCSS('outline-style', 'none');
  await expect(board.locator('[data-square="g1"] [data-piece="wK"]')).toBeVisible();
  await expect(board.locator('[data-square="a1"] [data-piece="wR"]')).toBeVisible();
  await play(fixture.wrong);
  await expect(page.getByRole('heading', {name: 'Mistake.', exact: true})).toBeVisible();
  const originalBoard = await documentBox(board);
  const originalHeader = await page.locator('header').boundingBox();
  await page.getByRole('button', {name: "Show me why"}).click();
  const dialog = page.getByRole('region', {name: 'Move explanation'});
  await expect(dialog.locator('.explanation-caption')).toContainText('In this line, White loses 5 points of material.');
  await expect(board.locator('[data-square="f1"] [data-piece="wK"]')).toBeVisible();
  await expect(dialog.locator('.explanation-caption')).toContainText("capturing White's rook");
  // Practice page heading styles must not inflate or squeeze the shared bubble.
  for (const label of await dialog.locator('.coach-title > *').all()) {
    expect(await label.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
  }
  await expect(board.locator('[data-square="a1"] .playback-highlight')).toBeVisible();
  if (testInfo.project.name === 'desktop') await expect(board).toBeInViewport({ratio: 1});
  const returnButton = dialog.getByRole('button', {name: 'Back to attempt'});
  await expect(returnButton).toBeInViewport({ratio: 1});
  const shownBoard = await documentBox(board);
  expect(shownBoard).toEqual(originalBoard);
  await expect(board).toHaveCSS('outline-style', 'none');
  expect(await page.locator('header').boundingBox()).toEqual(originalHeader);
  await expect(page.locator('.board-shell')).toHaveCount(1);
  if (testInfo.project.name === 'mobile') {
    const control = (await documentBox(returnButton))!;
    expect(control.y + control.height).toBeLessThan(shownBoard!.y);
  }
  await expect(board.locator('[data-square="a1"] [data-piece="bQ"]')).toBeVisible();
  await page.screenshot({path:`test-results/review-explanation-${testInfo.project.name}.png`});
  await dialog.getByRole('button', {name: 'Previous move', exact: true}).click();
  await expect(dialog.locator('.explanation-caption')).toContainText('White plays Kf1');
  await dialog.getByRole('button', {name: 'Back to attempt'}).click();
  await expect(dialog).toHaveCount(0);
  await expect(board.locator('[data-square="g1"] [data-piece="wK"]')).toBeVisible();
  await expect(page.locator('.move-status.retry')).toBeVisible();
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(before.reviews + 1);
  await page.reload();
  await page.getByRole('button', {name: "Show me why"}).click();
  await expect(dialog.locator('.explanation-caption')).toContainText('In this line, White loses 5 points of material.');
  await dialog.getByRole('button', {name:'Back to attempt'}).click();
  await play(fixture.alternative);
  await expect(page.locator('.review-move')).toHaveText('Bxa5');
  await expect(page.getByRole('button', {name:'Next position'})).toBeVisible();
  await page.getByRole('button', {name:'Show why', exact:true}).click();
  await expect(dialog.locator('.explanation-caption')).toContainText('In this line, White gains 9 points of material.');
  await expect(board.locator('[data-square="a5"] [data-piece="wB"]')).toBeVisible();
  const backToReview = dialog.getByRole('button', {name:'Back to review'});
  await expect(backToReview).toBeInViewport({ratio: 1});
  const successBoard = await documentBox(board);
  if (testInfo.project.name === 'mobile') {
    const control = (await documentBox(backToReview))!;
    expect(control.y + control.height).toBeLessThan(successBoard!.y);
  }
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(before.reviews + 1);
});


test('Reveal move plays the answer on the main board after a failed counter preview', async ({page}, testInfo) => {
  const fixture = await (await page.request.post(`/__test/review-explanation-fixture/reveal-${testInfo.project.name}`)).json();
  const before = await (await page.request.get('/api/stats')).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  const board = page.getByRole('region', {name: 'Chess position'});
  await board.locator('[data-square="g1"]').click();
  await board.locator('[data-square="f1"]').click();
  await expect(page.getByRole('heading', {name: 'Mistake.', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Try again', exact: true}).click();
  await page.getByRole('button', {name: 'Reveal move', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Move revealed.'})).toBeVisible();
  await expect(board.locator('[data-square="a5"] [data-piece="wR"]')).toBeVisible();
  await expect(board.locator('[data-square="a5"] [data-piece="bQ"]')).toHaveCount(0);
  await expect(board.locator('[data-square="a1"] [data-piece="wR"]')).toHaveCount(0);
  await expect(board.locator('[data-square="a5"] .playback-highlight')).toBeVisible();
  await expect(board.locator('[data-square="a1"] .playback-highlight')).toBeVisible();
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  const dialog = page.getByRole('region', {name: 'Move explanation'});
  await expect(board.locator('[data-square="a5"] [data-piece="wR"]')).toBeVisible();
  await dialog.getByRole('button', {name: 'Back to review'}).click();
  await expect(board.locator('[data-square="a5"] [data-piece="wR"]')).toBeVisible();
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(before.reviews + 1);
});


test('local classification settings and evidence work without model connectivity', async ({page}, testInfo) => {
  const imported = await (await page.request.post('/api/imports', {multipart: {
    file: {name:'local-classification.pgn', mimeType:'text/plain', buffer:Buffer.from(`[Round "Local rules ${testInfo.project.name}"]\n[White "Rule Learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1`)},
    usernames:'Rule Learner', side:'auto',
  }})).json();
  await expect.poll(async () => (await (await page.request.get('/api/jobs')).json()).find((j:{id:string}) => j.id === imported.job_id)?.status, {timeout:30000}).toBe('completed');
  await page.goto('/');
  await page.getByRole('link', {name:'Settings', exact:true}).click();
  await page.getByRole('navigation', {name: 'Settings sections'}).getByRole('link', {name: 'Advanced', exact: true}).click();
  await expect(page.getByRole('heading', {name:'Training tools', exact:true})).toBeVisible();
  await expect(page.getByRole('button', {name:'Classify saved games'})).toBeVisible();
  await expect(page.getByText('API key', {exact:true})).toHaveCount(0);
  const config = await (await page.request.get('/api/settings')).json();
  expect(config.classification_provider).toBe('local_rules');
  expect(config.openai_model).toBeUndefined();
  await page.getByRole('link', {name:'Weaknesses', exact:true}).click();
  const weakness = page.locator('.weakness').filter({has: page.getByRole('heading', {name:'Allowed mate', exact:true})});
  await weakness.getByText(/Browse supporting positions/).click();
  await weakness.getByRole('button', {name:'Example 1', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Decision evidence'});
  await expect(dialog.getByText('LOCAL RULE FINDING', {exact:true})).toBeVisible();
  await dialog.getByRole('button', {name:'View classification audit'}).first().click();
  await expect(dialog.locator('.audit')).toContainText('local_rules');
  await expect(dialog.locator('.audit')).toContainText('allowed_opponent_tactic');
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.evaluate(element => {element.scrollTop = element.scrollHeight;});
  await expect(dialog.getByRole('button', {name: 'Close evidence'})).toBeInViewport({ratio: 1});
  await page.screenshot({path: `test-results/evidence-${testInfo.project.name}.png`});
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(weakness.getByRole('button', {name:'Example 1', exact:true})).toBeFocused();
});


test('compact workspace keeps navigation reachable and settings focused on user actions', async ({page}, testInfo) => {
  await page.goto('/');
  if (testInfo.project.name === 'mobile') await page.setViewportSize({width: 390, height: 700});
  for (const tab of ['Weaknesses', 'Settings']) {
    await page.getByRole('navigation', {name: 'Main navigation'}).getByRole('link', {name: tab, exact: true}).click();
    await expect(page.locator('main h1')).toHaveText(tab);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    if (testInfo.project.name === 'mobile') {
      expect((await page.locator('header').boundingBox())!.height).toBeLessThanOrEqual(60);
      await expect(page.locator('main h1')).toHaveCSS('font-size', '22px');
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      expect((await page.getByRole('navigation', {name: 'Main navigation'}).boundingBox())!.y).toBeGreaterThanOrEqual(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await expect(page.getByRole('button', {name: 'Classify saved games', exact: true})).toHaveCount(0);
  await page.getByRole('navigation', {name: 'Settings sections'}).getByRole('link', {name: 'Advanced', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Classify saved games', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Deepen unclear positions', exact: true})).toBeEnabled();
  await expect(page.getByRole('link', {name: 'Download source code'})).toHaveAttribute('href', '/assets/fieldwork-source.zip');
  for (const label of ['Engine path', 'Engine configuration', 'Storage & connection', 'Database', 'Training policy']) {
    await expect(page.getByText(label, {exact: true})).toHaveCount(0);
  }
  await expect(page.locator('.app-header')).not.toContainText(/Local|Private account/);
  await page.getByRole('navigation').getByRole('link', {name: 'Settings', exact: true}).click();
  await page.getByRole('region', {name: 'Recent Chess.com games', exact: true}).getByRole('button', {name: 'Import older games', exact: true}).click();
  await expect(page.getByLabel('From date')).not.toBeVisible();
  await page.getByText('Custom date range', {exact: true}).click();
  await page.getByLabel('From date').fill('2026-01-01');
  await expect(page.getByLabel('Look back')).toBeDisabled();
  await page.getByRole('button', {name: 'Clear dates', exact: true}).click();
  await expect(page.getByLabel('Look back')).toBeEnabled();
  await expect(page.getByLabel('From date')).toHaveValue('');
  if (testInfo.project.name === 'mobile') {
    for (const width of [320, 360, 390, 430]) {
      await page.setViewportSize({width, height: 700});
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  }
});


test('explanation loading and errors keep the header and original board in place', async ({page}, testInfo) => {
  if (testInfo.project.name === 'mobile') await page.setViewportSize({width: 375, height: 600});
  const fixture = await (await page.request.post(`/__test/review-explanation-fixture/stable-${testInfo.project.name}`)).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  await page.getByRole('button', {name: 'Reveal move', exact: true}).click();
  const board = page.locator('.board-shell');
  await expect(page.getByRole('heading', {name: 'Move revealed.'})).toBeVisible();
  const boardBefore = await documentBox(board);
  const headerBefore = await page.locator('header').boundingBox();
  const titleBefore = await documentBox(page.locator('.review-workspace-heading'));
  await board.evaluate(element => element.setAttribute('data-preserved', 'yes'));
  let release!: () => void;
  const gate = new Promise<void>(resolve => {release = resolve;});
  await page.route('**/api/review/sessions/*/explanation?*', async route => {
    await gate;
    await route.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({detail: 'Saved explanation temporarily unavailable.'})});
  });
  const before = await (await page.request.get('/api/stats')).json();
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  const playback = page.getByRole('region', {name: 'Move explanation'});
  await expect(playback.getByRole('status')).toContainText('Loading');
  const stable = async () => {
    await expect(page.locator('.board-shell')).toHaveCount(1);
    await expect(board).toHaveAttribute('data-preserved', 'yes');
    expect(await documentBox(board)).toEqual(boardBefore);
    expect(await page.locator('header').boundingBox()).toEqual(headerBefore);
    expect(await documentBox(page.locator('.review-workspace-heading'))).toEqual(titleBefore);
    await expect(page.getByRole('navigation')).toBeInViewport({ratio: 1});
  };
  await stable();
  release();
  await expect(playback.getByRole('alert')).toContainText('temporarily unavailable');
  await stable();
  await page.keyboard.press('Escape');
  await expect(playback).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Show why', exact: true})).toBeFocused();
  await stable();
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(before.reviews);
});


test('an unavailable grading request never marks the board as a mistake', async ({page}) => {
  const response = await page.request.post('/api/exercises/manual', {data: {
    fen: '1k6/8/8/8/8/8/4P3/4K3 w - - 0 1', moves: ['e2e4'],
  }});
  const {id} = await response.json();
  await page.goto(`/?exercise=${id}`);
  await page.route('**/api/review/sessions/*/move', route => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({detail: 'Analysis unavailable. Please retry.'}),
  }));
  const before = (await (await page.request.get('/api/stats')).json()).reviews;
  const board = page.locator('.board-shell');
  await board.locator('[data-square="e2"]').click();
  await board.locator('[data-square="e3"]').click();
  await expect(page.getByRole('alert')).toContainText('Analysis unavailable');
  await expect(board).toHaveCSS('outline-style', 'none');
  await expect(page.getByRole('heading', {name: 'Mistake.', exact: true})).toHaveCount(0);
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(before);
});


test('playback shows a repeated summary and move annotation only once', async ({page}, testInfo) => {
  const fixture = await (await page.request.post(`/__test/review-explanation-fixture/duplicate-${testInfo.project.name}`)).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  await expect(page.getByRole('button', {name: 'Reveal move', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Show move', exact: true})).toHaveCount(0);
  let repeated = '';
  await page.route('**/api/review/sessions/*/explanation?*', async route => {
    const response = await route.fetch();
    const payload = await response.json();
    repeated = payload.frames[2].annotation;
    payload.summary = repeated;
    await route.fulfill({response, json: payload});
  });
  const board = page.locator('.board-shell');
  await board.locator(`[data-square="${fixture.wrong.slice(0, 2)}"]`).click();
  await board.locator(`[data-square="${fixture.wrong.slice(2, 4)}"]`).click();
  await expect(page.getByRole('button', {name: 'Try again', exact: true})).toBeVisible();
  await page.getByRole('button', {name: 'Show me why', exact: true}).click();
  const playback = page.getByRole('region', {name: 'Move explanation'});
  await expect(playback.locator('.explanation-caption')).toContainText('capturing');
  const caption = playback.locator('.explanation-caption');
  await expect.poll(async () => (await caption.innerText()).split(repeated).length - 1).toBe(1);
  await playback.getByRole('button', {name: 'Previous move', exact: true}).click();
  await expect(caption).toContainText(repeated);
  await expect(playback.locator('.explanation-caption')).toContainText('White plays');
  await playback.getByRole('button', {name: 'Next move', exact: true}).click();
  await expect.poll(async () => (await caption.innerText()).split(repeated).length - 1).toBe(1);
});


test('focused practice highlights a verified pattern without scheduling a recall', async ({page}, testInfo) => {
  const fixture = await (await page.request.post(`/__test/classified-fixture/focus-${testInfo.project.name}`)).json();
  await page.goto('/');
  await page.getByRole('navigation').getByRole('link', {name: 'Weaknesses', exact: true}).click();
  await expect(page.getByRole('region', {name: 'Tactical patterns', exact: true})).toBeVisible();
  const weakness = page.locator('.weakness').filter({has: page.getByRole('heading', {name: 'Missed tactical capture', exact: true})});
  const before = (await (await page.request.get('/api/stats')).json()).reviews;
  await weakness.getByRole('link', {name: /Practice .* positions/}).click();
  await expect(page).toHaveURL(/\/study\/due\?focus=/);
  const focusedUrl = page.url();
  await expect(page.getByText('FOCUSED PRACTICE', {exact: true})).toBeAttached();
  await expect(page.getByText('practiced this session', {exact: true})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'Your move.'})).toBeVisible();
  await page.getByRole('button', {name: 'Reveal move', exact: true}).click();
  await expect(page.getByText('Focused practice. Your review schedule is unchanged.')).toBeVisible();
  const board = page.locator('.board-shell');
  const box = await documentBox(board);
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  await page.getByRole('button', {name: 'Show undefended capture', exact: true}).click();
  await expect(board.locator('[data-pattern-square]')).toHaveCount(2);
  await expect(board.locator('[data-pattern-square="a5"]')).toBeVisible();
  await expect(board.locator('[data-square="a5"] [data-piece="bQ"]')).toBeVisible();
  await expect(board.locator('[data-square="a1"] [data-piece="wR"]')).toBeVisible();
  expect(await documentBox(board)).toEqual(box);
  await expect(page.getByText('Next time:', {exact: false})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/pattern-${testInfo.project.name}.png`, fullPage: true});
  await page.getByRole('button', {name: 'Back to review', exact: true}).click();
  await expect(board.locator('[data-pattern-square]')).toHaveCount(0);
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(before);
  await page.getByRole('link', {name: 'Return to mixed review', exact: true}).click();
  await expect(page).toHaveURL('/study/due');
  await expect(page.getByText('FOCUSED PRACTICE', {exact: true})).toHaveCount(0);
  await page.goBack();
  await expect(page).toHaveURL(focusedUrl);
  await expect(page.getByText('FOCUSED PRACTICE', {exact: true})).toBeAttached();
  await expect(page.getByRole('link', {name: 'Return to mixed review', exact: true})).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL('/weaknesses');
  await expect(weakness).toBeVisible();
  expect(fixture.exercise_id).toBeTruthy();
});
