import { test, expect } from '@playwright/test';

test('create a curated position, fail once, solve by tapping and retain after reload', async ({page}, testInfo) => {
  await page.goto('/');
  await expect(page.getByRole('heading', {name: 'Make the next good move.'})).toBeVisible();
  await page.getByRole('button', {name: 'Repertoire', exact: true}).click();
  await page.getByText('Add a manual position', {exact: true}).click();
  await page.getByLabel('FEN', {exact: true}).fill('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  await page.getByLabel('Expected move(s), UCI').fill(testInfo.project.name === 'mobile' ? 'd2d4' : 'e2e4');
  const savedPosition = page.waitForResponse(response => response.url().endsWith('/api/exercises/manual') && response.request().method() === 'POST');
  await page.getByRole('button', {name: 'Validate & add position'}).click();
  const exerciseId = (await (await savedPosition).json()).id;
  await expect(page.getByRole('status')).toHaveText('Position validated and added to your review queue.');
  await page.goto(`/?exercise=${exerciseId}`);
  await expect(page.getByRole('heading', {name: 'Read the board.'})).toBeVisible();
  await expect(page.getByText('Also accepted:', {exact: false})).not.toBeVisible();
  await page.screenshot({path: `test-results/${testInfo.project.name}-review.png`, fullPage: true});
  const board = page.locator('.board-shell');
  const square = (name: string) => board.locator(`[data-square="${name}"]`);
  const markers = board.locator('[data-legal-destination]');
  await square('e2').click();
  await expect(square('e2').locator('.board-square-content')).toHaveCSS('background-color', 'rgb(226, 199, 116)');
  await expect(markers).toHaveCount(2);
  await expect(board.locator('[data-legal-destination="e4"]')).toBeVisible();
  await square('e2').click();
  await expect(markers).toHaveCount(0);
  await square('e2').click(); await square('d2').click();
  await expect(board.locator('[data-legal-destination="d4"]')).toBeVisible();
  await expect(board.locator('[data-legal-destination="e4"]')).toHaveCount(0);
  await square('d5').click();
  await expect(markers).toHaveCount(0);
  await expect(page.getByRole('button', {name: 'Show move'})).toBeVisible();
  await square('g1').click(); await square('f3').click();
  await expect(page.getByRole('status').filter({hasText: 'Try again'})).toContainText('Try again');
  await expect(page.getByRole('button', {name: 'Show move'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', {name: 'Read the board.'})).toBeVisible();
  const file = testInfo.project.name === 'mobile' ? 'd' : 'e';
  await square(`${file}2`).click(); await square(`${file}4`).click();
  await expect(page.getByText('Solved. This recall stays marked for relearning.')).toBeVisible();
  await page.getByRole('button', {name: 'Next position'}).click();
  await expect(page.getByText('Solved. This recall stays marked for relearning.')).not.toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('PGN upload form imports a learner game and reports real analysis', async ({page}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Import', exact: true}).click();
  await page.getByRole('button', {name: 'PGN file', exact: true}).click();
  await page.getByText('Or paste PGN text', {exact: true}).click();
  await page.getByLabel('PGN', {exact: true}).fill(`[Round "${testInfo.project.name}"]\n[White "UI learner"]\n[Black "Opponent"]\n\n1. f3 e5 2. g4 Qh4# 0-1`);
  await page.getByLabel('Your username(s)').fill('UI learner');
  await page.getByRole('button', {name: 'Import & analyze'}).click();
  await expect(page.getByRole('status')).toContainText(/imported/);
  await expect(page.locator('.job .badge').first()).toHaveText('completed', {timeout: 30000});
  await expect(page.locator('.job').first()).toContainText('2 decisions');
  const previousJobs = await page.locator('.job').count();
  await page.getByRole('button', {name: 'Import & analyze'}).click();
  await expect(page.getByRole('status')).toContainText('0 imported');
  await expect(page.getByRole('status')).toContainText('1 duplicate');
  await expect(page.locator('.job')).toHaveCount(previousJobs);
});

test('promotion choice and drag interaction are graded by the backend', async ({page}, testInfo) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Repertoire', exact: true}).click();
  await page.getByText('Add a manual position', {exact: true}).click();
  await page.getByLabel('FEN', {exact: true}).fill('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  await page.getByLabel('Expected move(s), UCI').fill('a7a8n');
  const saved = page.waitForResponse(r => r.url().endsWith('/api/exercises/manual') && r.request().method() === 'POST');
  await page.getByRole('button', {name: 'Validate & add position'}).click();
  const id = (await (await saved).json()).id;
  await page.goto('/?exercise=' + id);
  await expect(page.getByRole('heading', {name: 'Read the board.'})).toBeVisible();
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
  await expect(page.getByText('Good move.', {exact: true})).toBeVisible();
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
  await expect(page.getByRole('status').filter({hasText: 'Try again'})).toBeVisible();
  await expect(board.locator('[data-legal-destination]')).toHaveCount(0);
  await square('e2').click();
  await expect(board.locator('[data-legal-destination="e8"].capture')).toBeVisible();
  await square('e8').click();
  await expect(page.getByText('Solved. This recall stays marked for relearning.')).toBeVisible();
  await expect(board.locator('[data-legal-destination]')).toHaveCount(0);
});

test('Chess.com username import fetches, analyzes and deduplicates without OpenAI', async ({page}, testInfo) => {
  const username = `ui-import-${testInfo.project.name}`;
  await page.goto('/');
  await page.getByRole('button', {name: 'Import', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Import from Chess.com'})).toBeVisible();
  await expect(page.getByLabel('Time control', {exact: true})).toHaveValue('rapid');
  await expect(page.getByLabel('Look back')).toHaveValue('3');
  await expect(page.getByLabel('Maximum new games')).toHaveValue('100');
  await page.getByLabel('Chess.com username', {exact: true}).fill(username);
  await page.getByLabel('Look back').selectOption('6');
  await page.getByLabel('Maximum new games').fill('25');
  const endDate = new Date().toISOString().slice(0, 10);
  const startDate = endDate.slice(0, 7) + '-01';
  await page.getByLabel('From date').fill(startDate);
  await page.getByLabel('To date').fill(endDate);
  await expect(page.getByLabel('Look back')).toBeDisabled();
  const queued = page.waitForResponse(r => r.url().endsWith('/api/imports/chesscom') && r.request().method() === 'POST');
  await page.getByRole('button', {name: 'Fetch & analyze games'}).click();
  const response = await queued;
  expect(response.status()).toBe(202);
  expect(response.request().postDataJSON()).toEqual({username, time_class: 'rapid', months: 6, max_games: 25, start_date: startDate, end_date: endDate});
  await expect(page.getByRole('status')).toContainText('Import queued');
  const job = page.locator('.job').filter({hasText: username}).first();
  await expect(job.locator('.badge')).toHaveText('completed', {timeout: 30000});
  await expect(job).toContainText('1 imported');
  await expect(job).toContainText('2 decisions');
  await page.screenshot({path: `test-results/${testInfo.project.name}-chesscom-import.png`, fullPage: true});
  await page.getByRole('button', {name: 'Fetch & analyze games'}).click();
  await expect(job).toContainText('0 imported · 1 duplicates', {timeout: 30000});
  await expect(job.locator('.badge')).toHaveText('completed', {timeout: 30000});
  await expect(job).toContainText('0 / 0 games');
  await expect(job).toContainText('No new games found');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Chess.com missing username reports a retryable provider error', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button', {name: 'Import', exact: true}).click();
  await page.getByLabel('Chess.com username', {exact: true}).fill('missing-player');
  await page.getByRole('button', {name: 'Fetch & analyze games'}).click();
  const job = page.locator('.job').filter({hasText: 'missing-player'}).first();
  await expect(job.locator('.badge')).toHaveText('failed', {timeout: 10000});
  await expect(job).toContainText('not found');
  await expect(job.getByRole('button', {name: 'Retry saved work'})).toBeVisible();
});
