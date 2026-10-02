import type { Page } from "@playwright/test";

// The installed clock keeps running while the page loads, and a cold dev-server load
// can take longer than a second, so pause one second after the page's own current time.
export async function pauseAfterLoad(page: Page) {
  const now = await page.evaluate(() => Date.now());
  await page.clock.pauseAt(now + 1000);
}
