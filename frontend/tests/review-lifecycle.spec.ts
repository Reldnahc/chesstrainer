import { test, expect } from '@playwright/test';

test('leaving an SRS session discards its late grading error', async ({page}, info) => {
  const fixture = await (await page.request.post(`/__test/review-explanation-fixture/lifecycle-${info.project.name}`)).json();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/review/sessions/*/move', async route => {
    await gate;
    await route.fulfill({status: 503, json: {detail: 'Failure from the previous review'}});
  });
  await page.goto(`/?exercise=${fixture.exercise_id}`);
  const board = page.locator('.board-shell');
  await board.locator(`[data-square="${fixture.wrong.slice(0, 2)}"]`).click();
  const submitted = page.waitForRequest(request => request.url().endsWith('/move') && request.method() === 'POST');
  await board.locator(`[data-square="${fixture.wrong.slice(2, 4)}"]`).click();
  await submitted;
  await page.getByRole('navigation').getByRole('link', {name: 'Settings', exact: true}).click();
  await expect(page.locator('main h1')).toBeVisible();
  const delivered = page.waitForResponse(response => response.url().endsWith('/move'));
  release();
  await (await delivered).finished();
  // Flush both the rejected fetch continuation and React's update before asserting.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.getByText('Failure from the previous review')).toHaveCount(0);
  await expect(page).toHaveURL(/\/settings$/);
});
