import { test, expect, type Locator } from '@playwright/test';

const geometry = (locator: Locator) => locator.evaluate(element => {
  const {x, y, width, height} = element.getBoundingClientRect();
  return {x, y: y + scrollY, width, height};
});

test('evaluation scales to the game, preserves mate scores, and keeps navigation stable', async ({page}, info) => {
  const {id} = await (await page.request.post(`/__test/game-review-fixture/evaluation-${info.project.name}`)).json();
  const game = await (await page.request.get(`/api/games/${id}`)).json();
  const source = game.frames.slice(1);
  const labels = ['Best', 'Brilliant', 'Great', 'Blunder', 'Mistake', 'Inaccuracy', 'Miss', 'Good', 'Book'];
  const scores = [
    {kind: 'cp', value: 35}, {kind: 'cp', value: -320},
    {kind: 'mate', value: 3}, {kind: 'mate', value: -2},
    {kind: 'mate', value: 0, mate_given: true}, {kind: 'mate', value: 0},
    {kind: 'cp', value: 0},
  ];
  const moves = Array.from({length: 24}, (_, index) => {
    const frame = source[index % source.length];
    const candidate = {uci: frame.uci, san: frame.san, pv: [], score: {kind: 'cp', value: 25}};
    return {...frame, number: Math.floor(index / 2) + 1, san: index === 21 ? 'bxa8=Q+' : frame.san,
      report: {label: labels[index % labels.length], coach: 'Position-specific coaching.', best: candidate, actual: candidate,
        white_score: scores[index] ?? {kind: 'cp', value: 100}, depth: 1, engine_version: 'Evaluation fixture', board_cues: null}};
  });
  game.frames = [game.frames[0], ...moves];
  game.job = {status: 'completed', completed: 24, total: 24};
  await page.route(`**/api/games/${id}`, route => route.fulfill({json: game}));
  await page.route(`**/api/games/${id}/analyze`, route => route.fulfill({json: {report: null, score: null, best_move: null}}));
  await page.goto(`/games/${id}?ply=1`);
  const graph = page.getByRole('region', {name: 'Original-game evaluation'});
  const coach = page.locator('.coach-speech');
  const axes = graph.locator('.game-graph-axis');
  const node = (ply: number) => graph.locator(`[data-ply="${ply}"]`);
  await expect(axes).toHaveText(['+4', '0', '−4']);
  await expect(graph.locator('.game-graph-white')).toHaveCount(1);
  for (const label of labels) {
    const marker = graph.locator(`.game-graph-node.label-${label.toLowerCase()}`).first();
    await expect(marker).toHaveAttribute('data-marked', String(!['Good', 'Book'].includes(label)));
  }
  await expect(graph.locator('.game-graph-legend')).toHaveCount(0);

  const previous = graph.getByRole('button', {name: 'Previous graph position'});
  const next = graph.getByRole('button', {name: 'Next graph position'});
  await next.scrollIntoViewIfNeeded();
  await page.evaluate(() => document.fonts.ready);
  const buttons = {previous: await geometry(previous), next: await geometry(next)};
  const bubbleHeight = (await geometry(coach)).height;
  for (const [ply, text, barText] of [[1, '+0.35', '+0.4'], [2, '−3.20', '−3.2'], [3, '+M3', '+M3'], [4, '−M2', '−M2'], [5, '+M0', '+M0'], [6, '−M0', '−M0'], [7, '+0.00', '+0.0']] as const) {
    if (info.project.name === 'mobile') await node(ply).tap(); else await node(ply).click();
    await expect(coach.locator('.evaluation-score')).toHaveText(text);
    await expect(graph.locator('.evaluation-score')).toHaveText(text);
    const bar = page.locator('.game-eval-bar > span');
    await expect(bar).toHaveText(barText);
    await expect(bar).toHaveCSS('writing-mode', 'horizontal-tb');
    const bounds = (await bar.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.width).toBeGreaterThan(bounds.height);
    expect(await bar.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(axes).toHaveText(['+4', '0', '−4']);
    expect({previous: await geometry(previous), next: await geometry(next)}).toEqual(buttons);
    expect((await geometry(coach)).height).toBe(bubbleHeight);
  }
  await page.getByRole('button', {name: 'Flip board', exact: true}).click();
  await node(2).click();
  await expect(coach.locator('.evaluation-score')).toHaveAttribute('data-side', 'black');
  await expect(coach.locator('.evaluation-score')).toHaveText('−3.20');
  await node(22).click();
  await expect(graph.locator('.game-graph-position')).toHaveText('Game · 11... bxa8=Q+');
  expect({previous: await geometry(previous), next: await geometry(next)}).toEqual(buttons);
  await previous.click();
  await expect(node(21)).toHaveAttribute('aria-current', 'step');
  await next.click();
  await expect(node(22)).toHaveAttribute('aria-current', 'step');

  // Larger finite scores expand both sides. Mate values do not determine the
  // numeric range, and selecting a different move never rescales the game.
  moves[7].report.white_score = {kind: 'cp', value: 730};
  await page.reload();
  await expect(axes).toHaveText(['+8', '0', '−8']);
  await node(8).click();
  await expect(coach.locator('.evaluation-score')).toHaveText('+7.30');
  expect(Number(await node(8).getAttribute('cy'))).toBeGreaterThan(Number(await node(3).getAttribute('cy')));
  moves[8].report.white_score = {kind: 'cp', value: -980};
  await page.reload();
  await expect(axes).toHaveText(['+10', '0', '−10']);
  await node(9).click();
  await expect(graph.locator('.evaluation-score')).toHaveText('−9.80');
  expect(Number(await node(9).getAttribute('cy'))).toBeLessThan(Number(await node(4).getAttribute('cy')));
  await node(1).click();
  await expect(axes).toHaveText(['+10', '0', '−10']);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => page.locator('.board-shell').evaluate(element => element.getAnimations({subtree: true}).length)).toBe(0);
  await page.screenshot({path: `test-results/evaluation-expanded-${info.project.name}.png`, fullPage: true});

  // A missing report stays a gap, not an invented continuation between known scores.
  game.frames[10] = {...game.frames[10], report: null};
  await page.reload();
  await expect(graph.locator('.game-graph-white')).toHaveCount(2);
  await next.scrollIntoViewIfNeeded();
  const plot = graph.locator('.game-evaluation-plot');
  const neighbors = await Promise.all([node(9), node(11)].map(n => n.getAttribute('cx')));
  await plot.click({position: {x: (Number(neighbors[0]) + Number(neighbors[1])) / 2, y: 2}});
  await expect(graph.locator('.evaluation-score')).toHaveText('—');
  await expect(coach.locator('.evaluation-score')).toHaveText('—');
  await expect(page.locator('.game-eval-bar > span')).toHaveText('—');
});
