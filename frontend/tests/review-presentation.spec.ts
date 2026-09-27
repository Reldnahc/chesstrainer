import { test, expect, type Locator } from '@playwright/test';

const geometry = (locator: Locator) => locator.evaluate(element => {
  const rect = element.getBoundingClientRect();
  return {top: rect.top + scrollY, height: rect.height, width: rect.width};
});

test('pages use full laptop width and 80 percent on larger screens without shrinking boards', async ({page}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Desktop container policy; phone geometry is checked separately.');
  const fixture = await (await page.request.post('/__test/review-explanation-fixture/page-width')).json();
  for (const size of [{width: 1920, height: 1080}, {width: 1441, height: 900}, {width: 1440, height: 900}, {width: 1366, height: 900}, {width: 1280, height: 800}, {width: 1000, height: 800}, {width: 800, height: 720}]) {
    const targetWidth = size.width * (size.width <= 1440 ? 1 : .8);
    await page.setViewportSize(size);
    await page.goto(`/?exercise=${fixture.exercise_id}`);
    await expect(page.getByRole('button', {name: 'Reveal move', exact: true})).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const main = page.locator('main');
    const board = page.locator('.board-shell');
    const sidebar = page.locator('.review-sidebar');
    // Compare with the previously full-width review using the same viewport.
    await main.evaluate(element => {element.style.width = '100%';});
    const fullBoard = (await board.boundingBox())!;
    const fullSidebar = (await sidebar.boundingBox())!;
    await main.evaluate(element => {element.style.removeProperty('width');});
    await expect.poll(async () => (await board.boundingBox())!.width).toBeCloseTo(fullBoard.width, 1);
    const container = (await main.boundingBox())!;
    expect(container.width).toBeGreaterThanOrEqual(targetWidth - 1);
    expect(container.width).toBeLessThanOrEqual(size.width);
    expect(container.x).toBeCloseTo((size.width - container.width) / 2, 1);
    if (size.width <= 1440) {
      expect(container.width).toBeCloseTo(size.width, 1);
      expect((await sidebar.boundingBox())!.width).toBeCloseTo(fullSidebar.width, 1);
      if (size.width === 1366) await page.screenshot({path: 'test-results/laptop-width-review.png', fullPage: true});
    }
    if (size.width === 1920) {
      expect(container.width).toBeCloseTo(size.width * .8, 1);
      expect((await sidebar.boundingBox())!.width).toBeLessThan(fullSidebar.width - 300);
      await page.screenshot({path: 'test-results/page-width-review-desktop.png', fullPage: true});
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    // Navigating away must remove the review's minimum width. Every ordinary
    // page and the header use the same responsive width.
    for (const name of ['Games', 'Weaknesses', 'Import', 'Settings']) {
      await page.getByRole('navigation').getByRole('link', {name, exact: true}).click();
      await expect(page.locator('main h1')).toBeVisible();
      expect(await main.evaluate(element => element.style.getPropertyValue('--review-min-width'))).toBe('');
      expect((await main.boundingBox())!.width).toBeCloseTo(targetWidth, 1);
      expect((await page.locator('.header-inner').boundingBox())!.width).toBeCloseTo(targetWidth, 1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await main.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
      if (size.width === 1920 && name === 'Import') await page.screenshot({path: 'test-results/page-width-import-desktop.png', fullPage: true});
      if (size.width === 1366 && name === 'Import') await page.screenshot({path: 'test-results/laptop-width-import.png', fullPage: true});
    }
  }
});

test('SRS and game review use identical board, header and coach geometry at each viewport', async ({page}, testInfo) => {
  const exercise = await (await page.request.post(`/__test/review-explanation-fixture/equal-layout-${testInfo.project.name}`)).json();
  const {id} = await (await page.request.post(`/__test/game-review-fixture/equal-layout-${testInfo.project.name}`)).json();
  expect((await page.request.post(`/api/games/${id}/review`, {data: {}})).ok()).toBe(true);
  await expect.poll(async () => (await (await page.request.get(`/api/games/${id}`)).json()).job?.status, {timeout: 30000}).toBe('completed');
  const sizes = testInfo.project.name === 'desktop'
    ? [{width: 1920, height: 1080}, {width: 1366, height: 768}, {width: 1000, height: 800}]
    : [{width: 390, height: 844}, {width: 375, height: 600}];
  const dimensions = () => page.evaluate(() => {
    const rect = (selector: string) => {
      const {x, y, width, height} = document.querySelector(selector)!.getBoundingClientRect();
      return {x: x + scrollX, y: y + scrollY, width, height};
    };
    return {board: rect('.board-shell'), heading: rect('.review-workspace-heading'), coach: rect('.coach-speech')};
  });
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto(`/games/${id}`);
    await expect(page.getByRole('button', {name: 'Last move', exact: true})).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const game = await dimensions();
    await page.screenshot({path: `test-results/shared-layout-game-${size.width}.png`, fullPage: true});
    await page.goto(`/?exercise=${exercise.exercise_id}`);
    await expect(page.getByRole('button', {name: 'Reveal move', exact: true})).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await expect.poll(dimensions).toEqual(game);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({path: `test-results/shared-layout-srs-${size.width}.png`, fullPage: true});
  }
});

test('SRS shares animated coaching, stable actions and reduced-motion feedback without exposing a cold answer', async ({page}, testInfo) => {
  if (testInfo.project.name === 'desktop') await page.setViewportSize({width: 1366, height: 768});
  const fixture = await (await page.request.post(`/__test/review-explanation-fixture/presentation-${testInfo.project.name}`)).json();
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  const board = page.locator('.board-shell');
  const bubble = page.locator('.coach-speech');
  const actions = page.locator('.coach-actions');
  const why = page.getByRole('button', {name: 'Show me why', exact: true});
  await expect(why).toBeDisabled();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('img', {name: 'Your chess coach'})).toBeVisible();
  await expect(page.locator('.move-badge, .board-quality, [data-pattern-square]')).toHaveCount(0);
  await expect(page.getByRole('heading', {name: 'Find a good move.'})).toBeVisible();
  await expect(page.getByText('Build better decisions, one position at a time.')).toBeHidden();
  expect((await geometry(page.locator('.review-workspace-heading'))).height).toBeLessThan(45);
  if (testInfo.project.name === 'desktop') {
    expect((await geometry(board)).width).toBeGreaterThan(580);
    await expect(board).toBeInViewport({ratio: 1});
  }
  const original = {board: await geometry(board), bubble: await geometry(bubble), actions: await geometry(actions)};
  expect(original.actions.top).toBeGreaterThanOrEqual(original.bubble.top + original.bubble.height);
  expect(original.bubble.height).toBeLessThanOrEqual(136);
  await expect(bubble.locator('.evaluation-score')).toHaveCount(0); // Cold SRS never reveals an evaluation.
  const beforeReviews = (await (await page.request.get('/api/stats')).json()).reviews;
  await page.screenshot({path: `test-results/srs-shared-cold-${testInfo.project.name}.png`, fullPage: true});

  await board.evaluate(element => {
    const observer = new MutationObserver(() => {
      if ([...element.querySelectorAll<HTMLElement>('[style]')].some(piece =>
        piece.style.transition.includes('280ms') && piece.style.transform.includes('translate'))) {
        element.setAttribute('data-animation-observed', 'true');
        observer.disconnect();
      }
    });
    observer.observe(element, {attributes: true, childList: true, subtree: true});
  });
  const play = async (uci: string) => {
    await board.locator(`[data-square="${uci.slice(0, 2)}"]`).click();
    await board.locator(`[data-square="${uci.slice(2, 4)}"]`).click();
  };
  await play(fixture.wrong);
  await expect(board).toHaveAttribute('data-animation-observed', 'true');
  await expect(board.locator('[data-square="a1"] [data-piece="bQ"]')).toBeVisible();
  await expect(page.locator('.move-badge')).toContainText('Retry');
  await expect(board.locator('.board-quality')).toHaveCount(0); // Never rate the opponent's reply as our failed attempt.
  expect(await geometry(bubble)).toEqual(original.bubble);
  expect(await geometry(actions)).toEqual(original.actions);
  await why.click();
  await expect(page.getByRole('region', {name: 'Move explanation'})).toContainText('loses 5 points');
  expect(await geometry(bubble)).toEqual(original.bubble);
  expect(await geometry(actions)).toEqual(original.actions);
  await page.getByRole('button', {name: 'Back to attempt', exact: true}).click();
  expect(await geometry(board)).toEqual(original.board);
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(beforeReviews + 1);

  await page.emulateMedia({reducedMotion: 'reduce'});
  await page.route('**/api/review/sessions/*/move', async route => {
    const response = await route.fetch();
    const result = await response.json();
    await route.fulfill({response, json: {...result, explanation_summary: `${result.explanation_summary} `.repeat(30)}});
  });
  await play(fixture.alternative);
  await expect(page.locator('.move-badge')).toContainText('Accepted');
  await expect(board.getByLabel('Move feedback: Accepted')).toHaveCSS('animation-name', 'none');
  await expect(board.locator('[data-square="a5"] .playback-highlight')).toBeVisible();
  expect(await geometry(bubble)).toEqual(original.bubble);
  expect(await geometry(actions)).toEqual(original.actions);
  expect(await bubble.locator('.coach-message').evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await board.evaluate(element => element.getAnimations({subtree: true}).length)).toBe(0);
  expect((await (await page.request.get('/api/stats')).json()).reviews).toBe(beforeReviews + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({path: `test-results/srs-shared-accepted-${testInfo.project.name}.png`, fullPage: true});
});
