import {test, expect} from '@playwright/test';

test('the review exports PGN, the FEN on the board and a GIF of the game', async ({page}, info) => {
  test.setTimeout(90_000);
  const {id} = await (await page.request.post(`/__test/clock-review-fixture/export-${info.project.name}`)).json();
  await page.goto(`/games/${id}?ply=4`);
  const open = page.getByRole('button', {name: 'Export game'});
  // Icon only, beside Next mistake, and still there on the Move quality tab.
  await expect(open).toHaveText('');
  await page.getByRole('tab', {name: 'Move quality'}).click();
  await expect(open).toBeVisible();
  await page.getByRole('tab', {name: 'Moves'}).click();
  await page.locator('.game-move-heading').screenshot({path: `test-results/export-button-${info.project.name}.png`});
  await open.click();
  const dialog = page.getByRole('dialog', {name: 'Export game'});
  await expect(dialog.getByRole('textbox', {name: 'PGN'})).toHaveValue(/\[White "Clock-export-[a-z]+"\][\s\S]*1\. e4 \{ \[%clk 0:03:01\] \} 1\.\.\. e5/);
  // The FEN is the position on the board (after 2. Nf3 Nc6), not the final one.
  await expect(dialog.getByRole('textbox', {name: /FEN/})).toHaveValue('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3');
  const pgn = page.waitForEvent('download');
  await dialog.getByRole('button', {name: 'Download'}).click();
  expect((await pgn).suggestedFilename()).toBe(`Clock-export-${info.project.name} vs ClockFixture.pgn`);
  await dialog.getByRole('button', {name: 'Make GIF'}).click();
  const preview = dialog.getByRole('img', {name: /^Animated game/});
  await expect(preview).toBeVisible({timeout: 30_000});
  // A real GIF: the header bytes and one frame per position (start plus eight moves).
  const gif = await preview.evaluate(async (image: HTMLImageElement) => {
    const bytes = new Uint8Array(await (await fetch(image.src)).arrayBuffer());
    let frames = 0;
    // A graphic control extension directly followed by an image descriptor.
    for (let i = 0; i < bytes.length - 8; i++)
      if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 4 && bytes[i + 7] === 0 && bytes[i + 8] === 0x2c) frames++;
    return {header: String.fromCharCode(...bytes.slice(0, 6)), frames, width: image.naturalWidth};
  });
  expect(gif).toEqual({header: 'GIF89a', frames: 9, width: 480});
  await page.screenshot({path: `test-results/export-dialog-${info.project.name}.png`, fullPage: false});
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', {name: 'Download'}).last().click();
  expect((await download).suggestedFilename()).toMatch(/\.gif$/);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(open).toBeFocused();
});

test('game lists have no export button; it lives on the review page', async ({page}, info) => {
  await page.request.post(`/__test/clock-review-fixture/list-export-${info.project.name}`);
  for (const path of ['/games', '/']) {
    await page.goto(path);
    await expect(page.locator('.game-library-item').first()).toBeVisible({timeout: 30_000});
    await expect(page.getByRole('button', {name: /^Export/})).toHaveCount(0);
  }
});

test('copy still works on the plain-HTTP LAN page, where the Clipboard API is missing', async ({page}, info) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', {value: undefined}));
  const {id} = await (await page.request.post(`/__test/clock-review-fixture/copy-${info.project.name}`)).json();
  await page.goto(`/games/${id}?ply=2`);
  await page.getByRole('button', {name: 'Export game'}).click();
  const dialog = page.getByRole('dialog', {name: 'Export game'});
  const copy = dialog.getByRole('button', {name: 'Copy FEN'});
  await copy.click();
  await expect(copy).toHaveText('Copied');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  // The scratch field is gone and focus is back on the button.
  await expect(dialog.locator('textarea')).toHaveCount(1);
  await expect(copy).toBeFocused();
});
