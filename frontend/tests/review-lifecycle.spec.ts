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

test('Try again after a dead session link opens the queue and clears the link', async ({page}) => {
  let asked = 0;
  await page.route('**/api/review/sessions/dead-session', route => {
    asked += 1;
    return route.fulfill({status: 404, json: {detail: 'This review session no longer exists.'}});
  });
  await page.goto('/?session=dead-session');
  await expect(page.getByText('This review session no longer exists.')).toBeVisible();
  await page.getByRole('button', {name: 'Try again', exact: true}).click();
  await expect(page.getByText('This review session no longer exists.')).toHaveCount(0);
  await expect(page).not.toHaveURL(/session=/);
  // A reload opens the queue rather than the same missing session.
  const counted = page.waitForResponse(response => response.url().includes('/api/review/count'));
  await page.reload();
  await counted;
  await expect(page.getByText('This review session no longer exists.')).toHaveCount(0);
  expect(asked).toBe(1);
});
