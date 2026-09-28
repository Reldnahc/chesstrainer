import {test, expect} from '@playwright/test';

test('piece and interface motion saves independently and follows the device only by default', async ({page}, info) => {
  const original = await (await page.request.get('/api/preferences/motion')).json();
  const coach = await (await page.request.get('/api/preferences/coach')).json();
  try {
    await page.request.put('/api/preferences/motion', {data: {motion: 'system'}});
    await page.request.put('/api/preferences/coach', {data: {...coach, motion: 'still'}});
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.goto('/settings');
    const animations = page.getByRole('region', {name: 'Animations', exact: true});
    const motion = animations.getByLabel('Piece & interface motion', {exact: true});
    const coachMotion = animations.getByLabel('Coach motion', {exact: true});
    const portrait = page.locator('.coach-option:has(input:checked) .coach-avatar');
    const root = page.locator('html');
    await expect(motion).toBeEnabled();
    await expect(motion).toHaveValue('system');
    await expect(motion.locator('option')).toHaveText(['Use device setting', 'Animated', 'Still']);
    await expect(root).toHaveAttribute('data-interface-motion', 'still');
    await motion.selectOption('natural');
    await expect(page.locator('.motion-preference-status')).toContainText('Saved');
    await expect(root).toHaveAttribute('data-interface-motion', 'natural');
    await expect(portrait).toHaveAttribute('data-motion', 'still');
    await page.reload();
    await expect(motion).toHaveValue('natural');
    await expect(root).toHaveAttribute('data-interface-motion', 'natural');

    await page.emulateMedia({reducedMotion: 'no-preference'});
    await motion.selectOption('still');
    await expect(root).toHaveAttribute('data-interface-motion', 'still');
    await coachMotion.selectOption('natural');
    await expect(animations.locator('.coach-motion-preference-status')).toContainText('Saved');
    await expect(portrait).toHaveAttribute('data-motion', 'natural');
    await portrait.scrollIntoViewIfNeeded();
    await expect.poll(() => portrait.evaluate(element => element.getAnimations({subtree: true}).length)).toBeGreaterThan(0);
    await expect(root).toHaveAttribute('data-interface-motion', 'still');
    await page.reload();
    await expect(motion).toHaveValue('still');
    await expect(root).toHaveAttribute('data-interface-motion', 'still');
    await expect(portrait).toHaveAttribute('data-motion', 'natural');

    await motion.selectOption('system');
    await expect(root).toHaveAttribute('data-interface-motion', 'natural');
    await page.emulateMedia({reducedMotion: 'reduce'});
    await expect(root).toHaveAttribute('data-interface-motion', 'still');
    await page.getByRole('link', {name: 'Games', exact: true}).click();
    await page.emulateMedia({reducedMotion: 'no-preference'});
    await expect(root).toHaveAttribute('data-interface-motion', 'natural');
    await page.getByRole('link', {name: 'Settings', exact: true}).click();
    await expect(motion).toHaveValue('system');
    if (info.project.name === 'mobile') await page.setViewportSize({width: 320, height: 700});
    await animations.screenshot({path: `test-results/motion-settings-${info.project.name}.png`});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  } finally {
    await page.request.put('/api/preferences/motion', {data: original});
    await page.request.put('/api/preferences/coach', {data: coach});
  }
});

test('saved motion controls actual pieces, board feedback and interface transitions', async ({page}, info) => {
  const original = await (await page.request.get('/api/preferences/motion')).json();
  const coach = await (await page.request.get('/api/preferences/coach')).json();
  const {id} = await (await page.request.post(`/__test/game-review-fixture/motion-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  for (const frame of game.frames.slice(1)) {
    const candidate = {uci: frame.uci, san: frame.san, pv: [], score: {kind: 'cp', value: 50}};
    frame.report = {label: 'Good', coach: 'A sound move.', reason: '', best: candidate, actual: candidate,
      white_score: candidate.score, depth: 1, engine_version: 'Motion fixture', board_cues: null};
  }
  game.job = {id: 'motion-review', status: 'completed', completed: 4, total: 4};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: game.job.id, status: 'completed'}}));
  try {
    for (const [device, motion, animated] of [
      ['reduce', 'natural', true], ['no-preference', 'still', false],
      ['reduce', 'system', false], ['no-preference', 'system', true],
    ] as const) {
      await page.request.put('/api/preferences/motion', {data: {motion}});
      await page.request.put('/api/preferences/coach', {data: {...coach, motion: animated ? 'still' : 'natural'}});
      await page.emulateMedia({reducedMotion: device});
      await page.goto(`/games/${id}?ply=1`);
      await expect(page.locator('html')).toHaveAttribute('data-interface-motion', animated ? 'natural' : 'still');
      const board = page.locator('.board-shell');
      await expect(board).toBeVisible();
      await board.evaluate(element => {
        element.dataset.pieceMotion = 'none';
        const observer = new MutationObserver(() => {
          if ([...element.querySelectorAll<HTMLElement>('[style]')].some(piece =>
            piece.style.transform.includes('translate') &&
            getComputedStyle(piece).transitionProperty.includes('transform') &&
            getComputedStyle(piece).transitionDuration !== '0s')) {
            element.setAttribute('data-piece-motion', 'animated');
            observer.disconnect();
          }
        });
        observer.observe(element, {attributes: true, childList: true, subtree: true});
        // The test disconnects even when Still produces no animation mutation.
        (element as HTMLElement & {stopObserving: () => void}).stopObserving = () => observer.disconnect();
      });
      await page.getByRole('button', {name: 'Next move', exact: true}).click();
      await expect(page.getByRole('button', {name: '1... e5, Good', exact: true})).toHaveAttribute('aria-current', 'step');
      await expect(board).toHaveAttribute('data-piece-motion', animated ? 'animated' : 'none');
      await expect(page.locator('.board-quality')).toHaveCSS('animation-name', animated ? 'rating-appear' : 'none');
      await expect(page.locator('.game-eval-bar > div')).toHaveCSS('transition-duration', animated ? '0.25s' : '0s');
      const durations = await page.getByRole('button', {name: 'Next move', exact: true}).evaluate(element =>
        getComputedStyle(element).transitionDuration.split(',').map(value => Number.parseFloat(value)));
      expect(durations.some(duration => duration > 0)).toBe(animated);
      await expect(page.locator('.review-coach .coach-avatar')).toHaveAttribute('data-motion', animated ? 'still' : 'natural');
      if (!animated) expect(await board.evaluate(element => element.getAnimations({subtree: true}).length)).toBe(0);
      await board.evaluate(element => (element as HTMLElement & {stopObserving: () => void}).stopObserving());
    }
  } finally {
    await page.request.put('/api/preferences/motion', {data: original});
    await page.request.put('/api/preferences/coach', {data: coach});
  }
});

test('motion load and save failures are recoverable without losing the saved choice', async ({page}) => {
  const original = await (await page.request.get('/api/preferences/motion')).json();
  await page.request.put('/api/preferences/motion', {data: {motion: 'natural'}});
  let failLoad = true, failSave = true;
  await page.route('**/api/preferences/motion', route => {
    const reading = route.request().method() === 'GET';
    if ((reading && failLoad) || (!reading && failSave)) {
      if (reading) failLoad = false; else failSave = false;
      return route.fulfill({status: 503, json: {detail: 'Motion preferences unavailable'}});
    }
    return route.continue();
  });
  try {
    await page.goto('/settings');
    const motion = page.getByLabel('Piece & interface motion', {exact: true});
    const status = page.locator('.motion-preference-status');
    await expect(status).toContainText('Motion preferences unavailable');
    await expect(motion).toBeDisabled();
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'still');
    await page.getByRole('button', {name: 'Reload motion preferences', exact: true}).click();
    await expect(motion).toBeEnabled();
    await expect(motion).toHaveValue('natural');
    await motion.selectOption('still');
    await expect(status).toContainText('Motion preferences unavailable');
    await expect(motion).toHaveValue('natural');
    await expect(page.locator('html')).toHaveAttribute('data-interface-motion', 'natural');
    await motion.selectOption('still');
    await expect(status).toContainText('Saved');
    await page.reload();
    await expect(motion).toHaveValue('still');
  } finally {
    await page.request.put('/api/preferences/motion', {data: original});
  }
});
