import { expect, test } from '@playwright/test';
import type { Job } from '../src/api';

test('native connection and history disclosures support keyboard and touch without losing open state on refresh', async ({page}, info) => {
  let games = 1;
  const job = (): Job => ({
    id: 'disclosure-history', status: 'completed', kind: 'training', user_id: 'disclosure-fixture',
    created_at: '2026-09-29T10:00:00Z', activity: null, cancel_requested: false,
    chesscom: null, classifications_completed: games, priority: 0, puzzles_found: 0, deep_completed: games, error: null,
    games_processed: games, games_total: games, import_id: null, mistakes_identified: games,
    positions_triaged: games * 2, probe_total: null, provider_import: null,
  });
  await page.route('**/api/jobs', route => route.fulfill({json: [job()]}));
  await page.route('**/api/providers/*/sync', route => route.fulfill({json: {
    provider: new URL(route.request().url()).pathname.split('/')[3], username: 'Original',
    job_id: null, status: 'not_started', checked_at: null, imported: 0, error: null,
  }}));
  await page.goto('/settings');
  const connection = page.getByRole('region', {name: 'Recent Chess.com games', exact: true});
  const connectionDetails = connection.locator('details');
  const connectionSummary = connectionDetails.locator('summary');
  await connectionSummary.focus();
  await connectionSummary.press('Space');
  await expect(connectionDetails).toHaveAttribute('open', '');
  const name = connection.getByLabel('Remembered Chess.com username', {exact: true});
  await name.fill('Unfinished_Edit');
  await expect(connectionDetails).toHaveAttribute('open', '');
  await expect(name).toHaveValue('Unfinished_Edit');

  const history = page.locator('.job-history > details');
  const summary = history.locator('summary');
  await expect(history).not.toHaveAttribute('open');
  await expect(summary).toHaveCSS('display', 'list-item');
  expect(await summary.evaluate(element => getComputedStyle(element).listStyleType)).not.toBe('none');
  await expect(summary).toContainText('Training analysis');
  await expect(summary).toContainText('1 / 1 games · 2 decisions');
  await expect(summary.locator('.badge')).toHaveText('completed');
  await expect(summary).toContainText('View details');
  expect(await summary.locator('.job-inspect').evaluate(element => getComputedStyle(element, '::after').content)).toBe('none');
  await summary.focus();
  await summary.press('Enter');
  await expect(history).toHaveAttribute('open', '');
  const original = await history.elementHandle();
  games = 2;
  await expect(summary).toContainText('2 / 2 games · 4 decisions');
  expect(await original!.evaluate(element => element.isConnected)).toBe(true);
  await expect(history).toHaveAttribute('open', '');
  await expect(history.getByRole('progressbar', {name: 'Analysis progress', exact: true})).toBeVisible();
  await expect(connectionDetails).toHaveAttribute('open', '');
  await expect(name).toHaveValue('Unfinished_Edit');
  await summary.press('Space');
  await expect(history).not.toHaveAttribute('open');
  if (info.project.name === 'mobile') await summary.tap();
  else await summary.click();
  await expect(history).toHaveAttribute('open', '');
  await page.evaluate(() => document.fonts.ready);
  for (const control of [connectionSummary, summary]) {
    expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('review disclosures keep answers absent while cold and reset their open state only after completion', async ({page}, info) => {
  const explanation = 'Native disclosure accepted-answer explanation.';
  const response = await page.request.post('/api/exercises/manual', {data: {
    fen: info.project.name === 'mobile' ? '5k2/8/8/8/8/8/6P1/1K6 w - - 0 1' : '5k2/8/8/8/8/8/6P1/K7 w - - 0 1',
    moves: ['g2g4'], explanation,
  }});
  expect(response.ok()).toBe(true);
  const {id} = await response.json();
  let attempts = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && /\/api\/review\/sessions\/[^/]+\/(move|reveal)$/.test(new URL(request.url()).pathname)) attempts++;
  });
  await page.goto(`/?exercise=${id}`);
  const details = page.locator('.review-details');
  const summary = details.locator('summary');
  await expect(summary).toHaveText('Review details');
  await summary.focus();
  await summary.press('Enter');
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('.answer-feedback')).toHaveCount(0);
  await expect(page.getByText(explanation, {exact: true})).toHaveCount(0);
  expect(attempts).toBe(0);
  const original = await details.elementHandle();
  const board = page.locator('.board-shell');
  await board.locator('[data-square="g2"]').click();
  await board.locator('[data-square="g3"]').click();
  await expect(page.locator('.move-status.retry')).toBeVisible();
  await expect(page.getByRole('button', {name: 'Reveal move', exact: true})).toBeEnabled();
  expect(await original!.evaluate(element => element.isConnected)).toBe(true);
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('.answer-feedback')).toHaveCount(0);
  await expect(page.getByText(explanation, {exact: true})).toHaveCount(0);
  await board.locator('[data-square="g2"]').click();
  await board.locator('[data-square="g4"]').click();
  await expect(summary).toHaveText('Answer & review details');
  await expect(details).not.toHaveAttribute('open');
  expect(await original!.evaluate(element => element.isConnected)).toBe(false);
  await summary.focus();
  await summary.press('Space');
  await expect(details).toHaveAttribute('open', '');
  await expect(details.locator('.answer-feedback')).toContainText('Accepted move: g4');
  await expect(details.getByText(explanation, {exact: true})).toBeVisible();
  expect(attempts).toBe(2);
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('game variations keep their native disclosure and a phone-sized activation target', async ({page}, info) => {
  const response = await page.request.post(`/__test/game-review-fixture/disclosure-${info.project.name}`);
  expect(response.ok()).toBe(true);
  const {id} = await response.json();
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: 'disclosure-review', status: 'completed'}}));
  await page.route(`**/api/games/${id}/analyze`, route => route.fulfill({json: {report: null, score: null, best_move: null}}));
  await page.goto(`/games/${id}?ply=2`);
  await expect(page.getByText('Original game', {exact: true})).toBeVisible();
  await page.locator('.board-shell [data-square="e2"]').click();
  await page.locator('.board-shell [data-square="e4"]').click();
  const details = page.locator('.game-variations');
  const summary = details.locator('summary');
  const move = details.locator('.game-variation-row button');
  await expect(summary).toHaveText('Variations (1)');
  await expect(details).toHaveAttribute('open', '');
  await expect(move).toContainText('e4');
  await expect(move).toHaveAttribute('aria-pressed', 'true');
  await expect(summary).toHaveCSS('display', 'list-item');
  expect(await summary.evaluate(element => getComputedStyle(element).listStyleType)).not.toBe('none');
  await page.evaluate(() => document.fonts.ready);
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await summary.focus();
  await summary.press('Enter');
  await expect(details).not.toHaveAttribute('open');
  await expect(move).toBeHidden();
  await page.getByRole('button', {name: 'Flip board', exact: true}).click();
  await expect(details).not.toHaveAttribute('open');
  if (info.project.name === 'mobile') await summary.tap();
  else await summary.click();
  await expect(details).toHaveAttribute('open', '');
  await expect(move).toBeVisible();
  await expect(move).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
