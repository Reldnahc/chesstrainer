import {test, expect, type Page} from '@playwright/test';
import walterBank from '../src/audio/speech/bank/manifest.json' with {type: 'json'};

const walter = (id: string) => id.split('+').map(part => walterBank.recordings.find(row => row.id === part)!.text).join(' ');

/** The moves line sits outside the scrolling message, inside the bubble, fully
 * visible, and the bubble has grown enough that the spoken line needs no scrolling. */
async function movesLineLayout(page: Page) {
  return page.locator('.review-coach').evaluate(element => {
    const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect();
    const speech = box('.coach-speech'), message = box('.coach-message'), moves = box('.coach-moves-line');
    return {below: moves.top >= message.bottom - 0.5, inside: moves.left >= speech.left && moves.right <= speech.right + 0.5
      && moves.bottom <= speech.bottom + 0.5, visible: moves.height > 0,
      scrolls: element.querySelector('.coach-message')!.scrollHeight > element.querySelector('.coach-message')!.clientHeight + 1};
  });
}

test('completed reviews stay move-by-move without a game story or critical-moment surface', async ({page}, info) => {
  test.setTimeout(90_000);
  const {id} = await (await page.request.post(`/__test/game-review-fixture/move-review-${info.project.name}`)).json();
  await page.goto(`/games/${id}`);
  await expect(page.locator('.game-summary caption')).toContainText('Complete game', {timeout: 60_000});
  await expect(page.getByRole('region', {name: 'Game summary'})).toHaveCount(0);
  await expect(page.getByRole('button', {name: /^Jump to/})).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText(/Game story|Critical moments|Book recognition is not a quality grade/i);
  await expect(page.locator('.coach-speech')).not.toContainText('Review complete.');
  const before = await page.locator('.board-shell').boundingBox();
  const move = page.getByRole('button', {name: '2. g4, Blunder', exact: true});
  await move.click();
  await expect(move).toHaveAttribute('aria-current', 'step');
  await expect(page).toHaveURL(/ply=3/);
  expect((await page.locator('.board-shell').boundingBox())!.width).toBe(before!.width);
  await expect(page.locator('.coach-speech')).toContainText(/\bforce(?:d)? (?:check)?mate\b/i);
  await expect(page.locator('.coach-speech')).toContainText('Black');
  await expect(page.locator('.coach-speech')).toContainText('Qh4#');
  // The bubble shows Walter's spoken line; the moves line keeps the real reply visible.
  const spoken = page.locator('.coach-message [data-utterance]');
  await expect(spoken).toHaveAttribute('data-spoken', /^allowed-mate(?:\+[a-z0-9-]+)?$/);
  // The visible line; the moves are announced after it in a screen-reader-only span.
  const line = walter((await spoken.getAttribute('data-spoken'))!);
  await expect.poll(() => spoken.evaluate(element => element.firstChild?.textContent)).toBe(line);
  await expect(spoken.locator('.sr-only')).toHaveText(/strongest reply: Qh4#, forced mate\.$/);
  const moves = page.locator('.coach-moves-line');
  await expect(moves).toHaveText('Black’s strongest reply: Qh4#, forced mate');
  await expect(moves.locator('strong')).toHaveText('Qh4#');
  expect(await movesLineLayout(page)).toEqual({below: true, inside: true, visible: true, scrolls: false});
  if (info.project.name === 'desktop') {
    for (const size of [{width: 1366, height: 768}, {width: 1366, height: 900}]) {
      await page.setViewportSize(size);
      // The board resizes to the new viewport; measure once it has settled.
      let board = await page.locator('.board-shell').boundingBox();
      await expect.poll(async () => {
        const previous = board;
        board = await page.locator('.board-shell').boundingBox();
        return JSON.stringify(board) === JSON.stringify(previous);
      }).toBe(true);
      expect(await movesLineLayout(page)).toEqual({below: true, inside: true, visible: true, scrolls: false});
      // The bubble grows in the sidebar; the board beside it never moves.
      await page.getByRole('button', {name: 'Previous move', exact: true}).click();
      expect(await page.locator('.board-shell').boundingBox()).toEqual(board);
      await page.getByRole('button', {name: 'Next move', exact: true}).click();
      await expect(move).toHaveAttribute('aria-current', 'step');
      expect(await page.locator('.board-shell').boundingBox()).toEqual(board);
    }
  }
  await page.locator('.review-coach').screenshot({path: `test-results/coach-moves-line-${info.project.name}.png`});
  // "Show why" keeps the written explanation, so the moves line steps aside.
  await page.getByRole('button', {name: 'Show why', exact: true}).click();
  await expect(spoken).not.toHaveAttribute('data-spoken', /./);
  await expect(moves).toHaveCount(0);
  await page.getByRole('button', {name: 'Hide why', exact: true}).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.reload();
  await expect(move).toHaveAttribute('aria-current', 'step');
  await expect(page.getByRole('region', {name: 'Game summary'})).toHaveCount(0);
});

test('a paused partial review keeps its resume control', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/partial-review-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  game.job = {id: 'paused-review', status: 'cancelled', completed: 1, total: 4, error: null, cancel_requested: false};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: 'paused-review', status: 'cancelled'}}));
  await page.goto(`/games/${id}`);
  await expect(page.getByRole('button', {name: 'Resume review'})).toBeVisible();
  await page.getByRole('tab', {name: 'Move quality', exact: true}).click();
  await expect(page.getByRole('button', {name: 'Resume review'})).toBeVisible();
  await expect(page.getByRole('table', {name: 'Move quality and accuracy'})).toBeVisible();
  await expect(page.locator('.game-summary caption')).toHaveText('Reviewed moves so far');
  await expect(page.getByRole('region', {name: 'Game summary'})).toHaveCount(0);
});

test('moves and move quality swap in one stable panel without adding page height', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/sidebar-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  game.white = 'APlayerWithAVeryLongUsername';
  game.black = 'Reldnahcs';
  game.accuracy = {version: 'layout-fixture', white: 87.3, black: 69.1};
  for (const frame of game.frames.slice(1)) {
    const candidate = {uci: frame.uci, san: frame.san, pv: [], score: {kind: 'cp', value: 50}};
    frame.report = {label: 'Good', coach: 'A sound move.', reason: '', best: candidate, actual: candidate,
      white_score: candidate.score, depth: 1, engine_version: 'Layout fixture', board_cues: null};
  }
  game.job = {id: 'layout-review', status: 'completed', completed: 4, total: 4};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: game.job.id, status: 'completed'}}));
  const sizes = info.project.name === 'desktop'
    ? [{width: 1366, height: 768}, {width: 1280, height: 600}, {width: 1000, height: 800}, {width: 1920, height: 1080}]
    : [{width: 390, height: 844}, {width: 320, height: 700}];
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto(`/games/${id}?ply=2`);
    const sidebar = page.locator('.review-sidebar');
    const movesTab = page.getByRole('tab', {name: 'Moves', exact: true});
    const qualityTab = page.getByRole('tab', {name: 'Move quality', exact: true});
    const quality = page.getByRole('table', {name: 'Move quality and accuracy'});
    const panel = page.locator('.game-notation');
    await expect(movesTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', {name: 'Moves', exact: true})).toBeVisible();
    await expect(quality).toBeHidden();
    await expect(page.getByRole('button', {name: '1... e5, Good', exact: true})).toHaveAttribute('aria-current', 'step');
    await page.evaluate(() => document.fonts.ready);
    await movesTab.scrollIntoViewIfNeeded();
    const before = await panel.boundingBox();
    const pageHeight = await page.evaluate(() => document.documentElement.scrollHeight);
    const board = (await page.locator('.board-shell').boundingBox())!;
    if (info.project.name === 'desktop') {
      await expect.poll(async () => {
        const pane = (await sidebar.boundingBox())!;
        const controls = (await page.getByRole('group', {name: 'Game navigation'}).boundingBox())!;
        return Math.abs(pane.y + pane.height - controls.y - controls.height);
      }).toBeLessThan(1);
    }
    await qualityTab.click();
    await expect(qualityTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel', {name: 'Moves', exact: true})).toBeHidden();
    await expect(quality).toBeVisible();
    await expect(page.getByRole('button', {name: 'Next mistake', exact: true})).toBeHidden();
    expect(await panel.boundingBox()).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(pageHeight);
    expect(await page.locator('.board-shell').boundingBox()).toEqual(board);
    await expect(quality.getByRole('columnheader')).toHaveCount(3);
    await expect(quality.getByRole('columnheader').nth(0)).toHaveAccessibleName(`${game.white} · White`);
    await expect(quality.getByRole('columnheader').nth(1)).toHaveAccessibleName('Move quality');
    await expect(quality.getByRole('columnheader').nth(2)).toHaveAccessibleName(`${game.black} · Black`);
    await expect(quality.getByText(game.white, {exact: true})).toHaveAttribute('title', `${game.white} · White`);
    await expect(quality.getByLabel('Accuracy for White', {exact: true}).locator('b')).toHaveText('87.3');
    await expect(quality.getByLabel('Accuracy for Black', {exact: true}).locator('b')).toHaveText('69.1');
    await expect(quality.getByRole('row', {name: '2 Good 2', exact: true})).toBeVisible();
    await expect(quality.getByRole('row')).toHaveCount(11);
    await expect(page.locator('details.game-summary, .game-summary summary')).toHaveCount(0);
    expect(before!.height).toBeGreaterThanOrEqual(240);
    expect((await page.locator('.game-evaluation-plot').boundingBox())!.height).toBe(120);
    const scale = await quality.evaluate(element => {
      const pane = element.closest('[role="tabpanel"]')!.getBoundingClientRect();
      const last = element.querySelector('tbody tr:last-child')!.getBoundingClientRect();
      const caption = element.querySelector('caption')!.getBoundingClientRect();
      return {
        width: pane.width, height: pane.height, rowHeight: last.height,
        overflow: element.closest('[role="tabpanel"]')!.scrollHeight - pane.height,
        unusedBottom: pane.bottom - last.bottom - caption.height,
        font: parseFloat(getComputedStyle(element).fontSize),
        labelFont: parseFloat(getComputedStyle(element.querySelector('.move-badge')!).fontSize),
      };
    });
    expect(scale.unusedBottom).toBeLessThanOrEqual(20);
    expect(scale.labelFont).toBe(scale.font);
    if (scale.height >= 240) expect(scale.overflow, JSON.stringify({size, ...scale})).toBeLessThanOrEqual(1);
    if (scale.height > 400 && scale.width > 400) {
      expect(scale.font).toBeGreaterThanOrEqual(16);
      expect(scale.rowHeight).toBeGreaterThanOrEqual(32);
    }
    const inset = await quality.evaluate(element => {
      const pane = element.closest('.game-notation')!;
      return pane.getBoundingClientRect().right - element.getBoundingClientRect().right;
    });
    expect(inset).toBeGreaterThanOrEqual(18);
    if (info.project.name === 'desktop') {
      expect(pageHeight).toBeLessThanOrEqual(size.height + 1);
      if (size.height >= 768) {
        expect(await sidebar.evaluate(element => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
      }
      const content = page.getByRole('tabpanel', {name: 'Move quality', exact: true});
      await content.evaluate(element => { element.scrollTop = element.scrollHeight; });
      await expect(quality.getByRole('columnheader', {name: `${game.white} · White`, exact: true})).toBeInViewport();
      await expect(quality.getByRole('columnheader', {name: `${game.black} · Black`, exact: true})).toBeInViewport();
      await expect(quality.getByRole('row', {name: '0 Blunder 0', exact: true})).toBeInViewport();
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      expect(await page.locator('.board-shell').boundingBox()).toEqual(board);
      await content.evaluate(element => { element.scrollTop = 0; });
    } else {
      await expect(sidebar).toHaveCSS('display', 'contents');
      expect(pageHeight).toBeGreaterThan(size.height);
      expect(await sidebar.evaluate(element => element.scrollTop)).toBe(0);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/review-quality-tab-${size.width}x${size.height}.png`, fullPage: true});
    await panel.screenshot({path: `test-results/move-quality-panel-${size.width}x${size.height}.png`});
    // Tab arrow keys change the panel, not the selected chess move.
    await qualityTab.focus();
    await qualityTab.press('ArrowLeft');
    await expect(movesTab).toBeFocused();
    await expect(movesTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('button', {name: '1... e5, Good', exact: true})).toHaveAttribute('aria-current', 'step');
    await expect(page).toHaveURL(new RegExp(`/games/${id}\\?ply=2$`));
    await movesTab.press('End');
    await expect(qualityTab).toBeFocused();
    await qualityTab.press('Home');
    await expect(movesTab).toBeFocused();
    await movesTab.press('ArrowRight');
    await expect(qualityTab).toBeFocused();
    await movesTab.click();
    expect((await panel.boundingBox())!.height).toBe(before!.height);
  }
});
