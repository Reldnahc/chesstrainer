import { test, expect } from '@playwright/test';

test('history aligns players, results and accuracy with compact metadata and working review links', async ({page}, info) => {
  if (info.project.name === 'desktop') await page.setViewportSize({width: 1366, height: 900});
  const {id} = await (await page.request.post(`/__test/game-review-fixture/history-info-${info.project.name}`)).json();
  const base = {id, white: 'HistoryMe', black: 'PlayerOne', white_rating: 637, black_rating: 630,
    learner_color: 'white', result: '1-0', status: 'not_started', move_count: 32,
    played_on: '2026.09.26', played_at: '2026-09-26T16:00:00+00:00', time_control: '600', time_control_label: '10 min', accuracy: null};
  const items = [
    base,
    {...base, id: 'reviewed', black: 'PlayerTwo', white_rating: 629, black_rating: 590,
      status: 'completed', result: '0-1', move_count: 45, accuracy: {white: 71.2, black: 67.2}},
    {...base, id: 'black-win', white: 'LongOpponentNameThatNeedsToFitOnAPhone', black: 'HistoryMe', learner_color: 'black',
      white_rating: null, status: 'completed', result: '0-1', time_control_label: '3 min + 2 sec',
      played_on: '????.??.??', played_at: '2026-09-25T23:00:00+00:00', accuracy: {white: 78.123, black: 92.345}},
    {...base, id: 'daily-draw', status: 'queued', result: '1/2-1/2', time_control_label: '3 days / move', move_count: 60},
    {...base, id: 'unknown', white_rating: null, black_rating: null, status: 'completed', result: '*',
      played_on: null, played_at: null, move_count: 0, time_control_label: null},
    {...base, id: 'paused', status: 'cancelled'},
    {...base, id: 'failed', status: 'failed'},
    {...base, id: 'running', status: 'running'},
  ];
  let analysisRequests = 0;
  page.on('request', request => {
    if (request.method() === 'POST' && /\/(review|analyze)$/.test(new URL(request.url()).pathname)) analysisRequests++;
  });
  await page.route('**/api/games?offset=*', route => route.fulfill({json: {total: items.length, items}}));
  await page.route('**/api/games/*/review', route => route.fulfill({status: 503, json: {detail: 'Review disabled in history fixture'}}));
  await page.route('**/api/games/*/analyze', route => route.fulfill({json: {report: null, score: null, best_move: null}}));
  await page.goto('/games');
  const rows = page.locator('.game-library-item');
  await expect(rows).toHaveCount(8);
  const first = rows.nth(0), reviewed = rows.nth(1), blackWin = rows.nth(2), draw = rows.nth(3), unknown = rows.nth(4);
  await expect(first.locator('.history-player').first()).toHaveText('HistoryMe(637)');
  await expect(first.locator('.history-color.white')).toHaveCount(1);
  await expect(first.locator('.history-color.black')).toHaveCount(1);
  await expect(first.locator('.history-time')).toHaveText('10 min');
  await expect(first.locator('.history-outcome')).toHaveText('Won');
  await expect(first.locator('.history-review-action')).toHaveText('Review');
  await expect(first.locator('.history-moves')).toContainText('32');
  await expect(first.locator('time')).toHaveText('Sep 26, 2026');
  await expect(first).toHaveAccessibleDescription(/White: HistoryMe, rated 637.*Black: PlayerOne, rated 630.*You won/);
  await expect(reviewed.locator('[data-color="white"]')).toHaveText('71.2');
  await expect(reviewed.locator('[data-color="black"]')).toHaveText('67.2');
  await expect(reviewed.locator('.history-outcome')).toHaveText('Lost');
  await expect(blackWin.locator('.history-outcome')).toHaveText('Won');
  await expect(blackWin.locator('.history-player').first().locator('.history-rating')).toHaveText('');
  await expect(blackWin.locator('[data-color="black"]')).toHaveText('92.3');
  await expect(blackWin.locator('time')).toHaveText('Sep 25, 2026');
  await expect(draw.locator('.history-scores')).toHaveText('½½');
  await expect(draw.locator('.history-outcome')).toHaveText('Draw');
  await expect(draw.locator('.history-review-action')).toHaveText('Queued');
  await expect(unknown.locator('.history-accuracy')).toHaveText('——');
  await expect(unknown.locator('.history-date')).toHaveText('—');
  await expect(rows.nth(5).locator('.history-review-action')).toHaveText('Resume');
  await expect(rows.nth(6).locator('.history-review-action')).toHaveText('Retry');
  await expect(rows.nth(7).locator('.history-review-action')).toHaveText('Reviewing…');
  await page.evaluate(() => document.fonts.ready);
  const alignment = await reviewed.evaluate(row => {
    const y = (selector: string) => [...row.querySelectorAll(selector)].map(el => el.getBoundingClientRect().y);
    return {players: y('.history-player'), scores: y('.history-scores .history-line'), accuracy: y('.history-accuracy .history-line')};
  });
  expect(alignment.scores).toEqual(alignment.players);
  expect(alignment.accuracy).toEqual(alignment.players);
  expect((await first.boundingBox())!.height).toBeLessThanOrEqual(info.project.name === 'desktop' ? 82 : 100);
  for (const width of info.project.name === 'desktop' ? [800, 1024, 1366] : [360, 390]) {
    await page.setViewportSize({width, height: 900});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const selector of ['.history-time', '.history-date', '.history-moves', '.history-accuracy']) await expect(blackWin.locator(selector)).toBeVisible();
  }
  expect(analysisRequests).toBe(0);
  await page.locator('.game-library').screenshot({path: `test-results/game-history-${info.project.name}.png`});
  await first.focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(`/games/${id}`);
  await expect(page.getByRole('link', {name: 'All games', exact: true})).toBeVisible();
  await page.goBack();
  await expect(rows).toHaveCount(8);
});
