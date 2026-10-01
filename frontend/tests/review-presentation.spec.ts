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
    for (const name of ['Games', 'Weaknesses', 'Settings']) {
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

test('review modes share board and coach sizing with only useful mobile controls', async ({page}, testInfo) => {
  const exercise = await (await page.request.post(`/__test/review-explanation-fixture/equal-layout-${testInfo.project.name}`)).json();
  const {id} = await (await page.request.post(`/__test/game-review-fixture/equal-layout-${testInfo.project.name}`)).json();
  expect((await page.request.post(`/api/games/${id}/review`, {data: {}})).ok()).toBe(true);
  await expect.poll(async () => (await (await page.request.get(`/api/games/${id}`)).json()).job?.status, {timeout: 30000}).toBe('completed');
  const sizes = testInfo.project.name === 'desktop'
    ? [{width: 1920, height: 1080}, {width: 1366, height: 768}, {width: 1000, height: 800}]
    : [{width: 390, height: 844}, {width: 375, height: 600}, {width: 320, height: 700}];
  const dimensions = () => page.evaluate(() => {
    const rect = (selector: string) => {
      const {x, y, width, height} = document.querySelector(selector)!.getBoundingClientRect();
      return {x: x + scrollX, y: y + scrollY, width, height};
    };
    const button = document.querySelector('.coach-actions button')!;
    const style = getComputedStyle(button);
    return {board: rect('.board-shell'), coach: rect('.coach-speech'), actions: {
      width: rect('.coach-actions').width, height: rect('.coach-actions').height,
      buttonWidth: button.getBoundingClientRect().width,
      buttonHeight: button.getBoundingClientRect().height,
      font: style.fontSize, padding: style.padding, lineHeight: style.lineHeight,
    }};
  });
  for (const size of sizes) {
    await page.setViewportSize(size);
    await page.goto(`/games/${id}`);
    await expect(page.getByRole('button', {name: 'Last move', exact: true})).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const game = await dimensions();
    const best = page.locator('.coach-portrait-caption');
    await expect(best).toContainText('Best');
    const portrait = await geometry(page.locator('.review-coach .coach-avatar'));
    const caption = await geometry(best);
    expect(caption.top - portrait.top - portrait.height).toBeCloseTo(8, 1);
    expect(caption.width).toBeCloseTo(portrait.width, 1);
    expect(caption.top + caption.height).toBeLessThanOrEqual(
      (await geometry(page.locator('.coach-actions'))).top + game.actions.height,
    );
    expect(await best.locator('strong').evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      const bounds = element.closest('.coach-portrait-caption')!.getBoundingClientRect();
      const text = range.getBoundingClientRect();
      return range.getClientRects().length === 1 && text.left >= bounds.left && text.right <= bounds.right;
    })).toBe(true);
    expect(game.actions.buttonWidth).toBeCloseTo((game.actions.width - 8) / 2, 1);
    expect(game.actions.buttonHeight).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.review-workspace-heading')).toHaveCount(0);
    const navigation = page.getByRole('group', {name: 'Game navigation'});
    const allGames = navigation.getByRole('link', {name: 'All games', exact: true});
    await expect(allGames).toHaveAttribute('href', '/games');
    const link = await geometry(allGames);
    expect(link.top).toBeGreaterThanOrEqual(game.board.y + game.board.height);
    expect((await allGames.boundingBox())!.x).toBe((await navigation.boundingBox())!.x);
    expect(await allGames.evaluate(element => getComputedStyle(element).borderTopWidth)).toBe('1px');
    if (size.width <= 760) {
      const controls = await navigation.evaluate(element => [...element.children].map(child => {
        const {left, right, top, height} = child.getBoundingClientRect();
        return {left, right, top, height};
      }));
      expect((await navigation.boundingBox())!.height).toBe(44);
      for (const [index, control] of controls.entries()) {
        if (index) expect(control.left).toBeGreaterThanOrEqual(controls[index - 1].right);
        if (index !== 3) {
          expect(control.top).toBe(controls[0].top);
          expect(control.height).toBe(44);
        }
      }
      expect(await allGames.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    }
    if (size.width > 760) {
      expect(game.coach.y).toBe((await page.locator('.review-sidebar').boundingBox())!.y);
    } else {
      const actions = await geometry(page.locator('.coach-actions'));
      expect(actions.top).toBeGreaterThanOrEqual(game.coach.y + game.coach.height);
      expect(actions.top + actions.height).toBeLessThan(game.board.y);
    }
    await page.screenshot({path: `test-results/shared-layout-game-${size.width}.png`, fullPage: true});
    await page.goto(`/?exercise=${exercise.exercise_id}`);
    await expect(page.getByRole('button', {name: 'Reveal move', exact: true})).toBeVisible();
    await expect(page.locator('.coach-portrait-caption')).toHaveCount(0);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.review-workspace-heading')).toBeVisible();
    await expect.poll(async () => {
      const practice = await dimensions();
      // SRS keeps its heading; game review starts directly with the coach.
      // On phones that heading also precedes the board. Sizes stay shared.
      return {
        board: {...practice.board, x: game.board.x, y: size.width <= 760 ? game.board.y : practice.board.y},
        coach: {...practice.coach, y: game.coach.y},
        actions: practice.actions,
      };
    }).toEqual(game);
    const practiceBoard = (await page.locator('.board-shell').boundingBox())!;
    const practiceRow = (await page.locator('.review-board-row').boundingBox())!;
    expect(practiceBoard.x + practiceBoard.width / 2).toBeCloseTo(practiceRow.x + practiceRow.width / 2, 1);
    if (size.width <= 760) {
      const toolbar = page.locator('.review-board-toolbar');
      await expect(toolbar.locator('.review-board-controls')).toHaveCount(0);
      await expect(toolbar.getByRole('button')).toHaveCount(1);
      const mute = toolbar.getByRole('button', {name: 'Mute sound on this device', exact: true});
      await expect(mute).toBeVisible();
      const muteBox = (await mute.boundingBox())!;
      const toolbarBox = (await toolbar.boundingBox())!;
      expect(muteBox.height).toBe(44);
      expect(muteBox.width).toBe(44);
      expect(muteBox.x + muteBox.width).toBeCloseTo(toolbarBox.x + toolbarBox.width, 1);
      expect(toolbarBox.height).toBe(54);
      const coach = await geometry(page.locator('.coach-speech'));
      const actions = await geometry(page.locator('.coach-actions'));
      const board = await geometry(page.locator('.board-shell'));
      const meta = await geometry(page.locator('.review-board-meta').first());
      expect(actions.top - coach.top - coach.height).toBeCloseTo(8, 1);
      expect(meta.top - actions.top - actions.height).toBeCloseTo(12, 1);
      expect(board.top).toBeGreaterThan(actions.top + actions.height);
    }
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
  const buttonWidth = (original.actions.width - 8) / 2;
  for (const button of await actions.getByRole('button').all()) {
    expect((await geometry(button)).width).toBeCloseTo(buttonWidth, 1);
  }
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
  expect((await geometry(page.getByRole('button', {name: 'Back to attempt', exact: true}))).width).toBeCloseTo(buttonWidth, 1);
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
