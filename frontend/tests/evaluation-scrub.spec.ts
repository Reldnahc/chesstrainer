import { test, expect } from '@playwright/test';

test('evaluation scrubs continuously, captures the pointer, and stops on release or cancellation', async ({page, context}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/scrub-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  game.frames = game.frames.map((frame: typeof game.frames[number], ply: number) => {
    if (!ply) return frame;
    const candidate = {uci: frame.uci, san: frame.san, pv: [], score: {kind: 'cp', value: ply * 100}};
    return {...frame, report: {label: 'Good', best: candidate, actual: candidate,
      white_score: candidate.score, depth: 1, engine_version: 'Scrubbing fixture', board_cues: null}};
  });
  game.job = {status: 'completed', completed: 4, total: 4};
  let searches = 0;
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/review`, route => route.fulfill({json: {job_id: 'scrub', status: 'completed'}}));
  await page.route(`**/api/games/${id}/analyze`, route => {
    searches++;
    return route.fulfill({json: {report: null, score: null, best_move: null}});
  });
  await page.goto(`/games/${id}?ply=1`);
  const graph = page.getByRole('region', {name: 'Original-game evaluation'});
  const plot = graph.locator('.game-evaluation-plot');
  const node = (ply: number) => plot.locator(`[data-ply="${ply}"]`);
  await plot.scrollIntoViewIfNeeded();
  await plot.evaluate(element => element.addEventListener('pointerdown', event => {
    element.setAttribute('data-test-pointer', String((event as PointerEvent).pointerId));
  }));
  const bounds = (await plot.boundingBox())!;
  const x = async (ply: number) => bounds.x + Number(await node(ply).getAttribute('cx'));
  const y = bounds.y + Number(await node(1).getAttribute('cy'));
  const touch = info.project.name === 'mobile' ? await context.newCDPSession(page) : null;
  const down = async (clientX: number) => {
    if (touch) await touch.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: clientX, y}]});
    else { await page.mouse.move(clientX, y); await page.mouse.down(); }
  };
  const move = async (clientX: number, clientY = y) => {
    if (touch) await touch.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: clientX, y: clientY}]});
    else await page.mouse.move(clientX, clientY);
  };
  const up = async () => {
    if (touch) await touch.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
    else await page.mouse.up();
  };
  const selected = async (ply: number) => {
    await expect(page.locator('.move-playback-counter')).toHaveText(`${ply} / 4`);
    await expect(page).toHaveURL(new RegExp(`/games/${id}${ply ? `\\?ply=${ply}` : ''}$`));
    if (ply) {
      await expect(node(ply)).toHaveAttribute('aria-current', 'step');
      await expect(graph.locator('.evaluation-score')).toHaveText(`+${ply}.00`);
      await expect(page.locator('.coach-speech .evaluation-score')).toHaveText(`+${ply}.00`);
      const square = ['f3', 'e5', 'g4', 'h4'][ply - 1];
      const piece = ['wP', 'bP', 'wP', 'bQ'][ply - 1];
      await expect(page.locator(`.board-shell [data-square="${square}"] [data-piece="${piece}"]`)).toHaveCount(1);
    }
  };

  // Assert each intermediate board while held, not just a final click on release.
  await down(await x(1));
  await move(await x(2));
  await selected(2);
  await expect(plot).toHaveCSS('cursor', 'grabbing');
  await move(await x(3));
  await selected(3);
  // Capture keeps working outside the SVG; the game ends clamp the selection.
  await move(bounds.x + bounds.width + 5);
  await selected(4);
  await move(bounds.x - 5);
  await selected(0);
  await up();
  await expect(plot).toHaveCSS('cursor', 'grab');
  await page.mouse.move(await x(2), y);
  await selected(0);

  // A second gesture works after capture has been released.
  await down(await x(2));
  await selected(2);
  await move(await x(3));
  await selected(3);
  if (touch) {
    await touch.send('Input.dispatchTouchEvent', {type: 'touchCancel', touchPoints: []});
  } else {
    // Losing capture (e.g. the browser interrupts a gesture) must also stop it.
    await plot.evaluate(element => {
      const pointerId = Number(element.getAttribute('data-test-pointer'));
      element.releasePointerCapture(pointerId);
    });
    await move(await x(1));
  }
  await expect(plot).toHaveCSS('cursor', 'grab');
  if (!touch) await up();
  await selected(3);
  await down(await x(1));
  await move(await x(2));
  await up();
  await selected(2);

  if (touch) {
    // Preserve native vertical scrolling on phones instead of trapping the page.
    const before = await page.evaluate(() => scrollY);
    await down(await x(2));
    await move(await x(2), y + 80);
    await up();
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(before);
    await expect(plot).toHaveCSS('cursor', 'grab');
    await touch.detach();
  }
  expect(searches).toBe(0);
});
