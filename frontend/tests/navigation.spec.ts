import { test, expect } from '@playwright/test';

test.beforeEach(async ({page}) => {
  // Navigation must work independently of Stockfish availability or analysis.
  await page.route('**/api/games/*/review', route => route.fulfill({status: 503, json: {detail: 'Review unavailable in this navigation fixture'}}));
  await page.route('**/api/games/*/analyze', route => route.fulfill({json: {report: null, score: null, best_move: null}}));
});

test('Back, Forward and refresh restore the game and move without a history entry per move', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/history-${info.project.name}`)).json();
  const documents: string[] = [];
  page.on('request', request => { if (request.isNavigationRequest()) documents.push(request.url()); });
  await page.goto('/');
  await expect(page).toHaveURL('/review');
  await page.getByRole('link', {name: 'Games', exact: true}).click();
  await expect(page).toHaveURL('/games');
  const gameLink = page.getByRole('link', {name: new RegExp(`Review-history-${info.project.name} vs CoachFixture`)});
  await expect(gameLink).toHaveAttribute('href', `/games/${id}`);
  await gameLink.click();
  await expect(page.getByRole('heading', {name: `Review-history-${info.project.name} vs CoachFixture`})).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  await page.getByRole('button', {name: '2. g4', exact: true}).click();
  await expect(page).toHaveURL(`/games/${id}?ply=3`);
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(`/games/${id}?ply=2`);
  await page.getByRole('button', {name: 'Last move', exact: true}).click();
  await expect(page).toHaveURL(`/games/${id}?ply=4`);
  expect(await page.evaluate(() => history.length)).toBe(historyLength);
  // The review's own shortcuts must leave browser navigation shortcuts alone.
  expect(await page.evaluate(() => ['ArrowLeft', 'ArrowRight'].map(key => {
    const event = new KeyboardEvent('keydown', {key, altKey: true, bubbles: true, cancelable: true});
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  }))).toEqual([false, false]);
  await page.getByRole('link', {name: 'Settings', exact: true}).click();
  await expect(page).toHaveURL('/settings');
  await expect(page).toHaveTitle('Settings · Fieldwork');
  await page.goBack();
  await expect(page).toHaveURL(`/games/${id}?ply=4`);
  await expect(page.getByRole('button', {name: '2... Qh4#', exact: true})).toHaveAttribute('aria-current', 'step');
  await page.goBack();
  await expect(page).toHaveURL('/games');
  await expect(page.getByRole('heading', {name: 'Your games'})).toBeVisible();
  await page.goForward();
  await expect(page.getByRole('button', {name: '2... Qh4#', exact: true})).toHaveAttribute('aria-current', 'step');
  expect(documents).toHaveLength(1);
  await page.reload();
  await expect(page.getByRole('button', {name: '2... Qh4#', exact: true})).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveTitle(`Review-history-${info.project.name} vs CoachFixture · Fieldwork`);
  await page.getByRole('link', {name: 'All games', exact: true}).click();
  await expect(page).toHaveURL('/games');
});

test('every screen has a bookmarkable link and clicking the active page adds no history', async ({page}) => {
  for (const name of ['Review', 'Games', 'Weaknesses', 'Import', 'Settings']) {
    const path = `/${name.toLowerCase()}`;
    const response = await page.goto(path);
    expect(response?.ok()).toBe(true);
    const link = page.getByRole('navigation').getByRole('link', {name, exact: true});
    await expect(link).toHaveAttribute('href', path);
    await expect(link).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('main h1')).toBeVisible();
    const length = await page.evaluate(() => history.length);
    await link.click();
    expect(await page.evaluate(() => history.length)).toBe(length);
    await page.reload();
    await expect(link).toHaveAttribute('aria-current', 'page');
  }
  await page.getByRole('link', {name: 'Games', exact: true}).focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/games');
  await expect(page.locator('#main-content')).toBeFocused();
});

test('game links support opening a second tab without navigating the first', async ({page, context}, info) => {
  test.skip(info.project.name !== 'desktop', 'Modifier-click is a desktop interaction.');
  const {id} = await (await page.request.post('/__test/game-review-fixture/new-tab')).json();
  await page.goto('/games');
  const opened = context.waitForEvent('page');
  await page.getByRole('link', {name: /Review-new-tab vs CoachFixture/}).click({modifiers: ['ControlOrMeta']});
  const other = await opened;
  try {
    await expect(other).toHaveURL(`/games/${id}`);
    await expect(other.getByRole('heading', {name: 'Review-new-tab vs CoachFixture'})).toBeVisible();
    await expect(page).toHaveURL('/games');
    await expect(page.getByRole('heading', {name: 'Your games'})).toBeVisible();
  } finally { await other.close(); }
});

test('returning to the library restores its page and scroll after the list loads', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/pagination-${info.project.name}`)).json();
  await page.route('**/api/games?offset=*', route => {
    const offset = Number(new URL(route.request().url()).searchParams.get('offset'));
    return route.fulfill({json: {total: 60, items: Array.from({length: offset < 60 ? 30 : 0}, (_, index) => ({
      id: index === 20 ? id : `library-${offset + index}`, white: `Library ${offset + index}`, black: 'Opponent',
      result: '0-1', played_on: '2026.09.26', status: 'not_started',
    }))}});
  });
  await page.goto('/games');
  await page.getByRole('button', {name: 'More games', exact: true}).click();
  await expect(page).toHaveURL('/games?page=2');
  const gameLink = page.getByRole('link', {name: /Library 50 vs Opponent/});
  await gameLink.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => window.scrollY);
  expect(scroll).toBeGreaterThan(500);
  await gameLink.click();
  await expect(page).toHaveURL(`/games/${id}?page=2`);
  await expect(page.getByRole('link', {name: 'All games', exact: true})).toHaveAttribute('href', '/games?page=2');
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page).toHaveURL('/games?page=2');
  await expect(gameLink).toBeVisible();
  await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - scroll)).toBeLessThan(2);
  await page.reload();
  await expect(gameLink).toBeVisible();
  await expect.poll(async () => Math.abs(await page.evaluate(() => window.scrollY) - scroll)).toBeLessThan(2);
  await page.goBack();
  await expect(page).toHaveURL('/games');
  await expect(page.locator('.game-pagination')).toContainText('1–30 of 60');
  await page.goto('/games?page=100');
  await expect(page.getByRole('heading', {name: 'No games on this page.'})).toBeVisible();
  await expect(page.locator('.game-pagination')).toHaveCount(0);
  await page.getByRole('link', {name: 'Back to your games', exact: true}).click();
  await expect(page).toHaveURL('/games');
});

test('invalid game positions and missing pages give a usable return path', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/invalid-link-${info.project.name}`)).json();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`/games/${id}?ply=99999`);
  await expect(page.getByRole('button', {name: '2... Qh4#', exact: true})).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveURL(`/games/${id}?ply=4`);
  await page.goto(`/games/${id}?ply=-1&page=invalid`);
  await expect(page.locator('.game-board-controls')).toContainText('0 / 4');
  await expect(page.getByRole('link', {name: 'All games', exact: true})).toHaveAttribute('href', '/games');
  await page.goto('/games/missing-game');
  await expect(page.getByRole('alert')).toContainText('Game not found');
  await page.getByRole('link', {name: 'All games', exact: true}).click();
  await expect(page.getByRole('heading', {name: 'Your games'})).toBeVisible();
  for (const address of ['/not-a-page', '/games/%E0%A4%A']) {
    await page.goto(address);
    await expect(page.getByRole('heading', {name: 'Page not found', exact: true})).toBeVisible();
    await page.getByRole('link', {name: 'Go to your games', exact: true}).click();
    await expect(page.getByRole('heading', {name: 'Your games'})).toBeVisible();
  }
  expect(errors).toEqual([]);
});
