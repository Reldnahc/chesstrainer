import { expect, type Locator, type Page } from "@playwright/test";

/**
 * Ctrl/Cmd-clicks `link` and checks that the app leaves the click to the
 * browser: the link points at `href`, nothing cancels the click and this page
 * stays where it is. The browser's own new tab is then cancelled here.
 *
 * Opening the tab is the browser's job, and waiting for it is unreliable:
 * Chromium sometimes commits a modifier-click tab's page before Playwright has
 * started listening to it. Playwright then never reports the tab, and the tab
 * never loads its data (about 1 in 50 clicks on CI runners, reproduced
 * October 14, 2026). See docs/TESTING.md.
 */
export async function expectModifierClickLeftToBrowser(page: Page, link: Locator, href: string) {
  await expect(link).toHaveAttribute("href", href);
  const before = page.url();
  // Registered on window after the app's own handlers, so it sees whether the
  // app cancelled the click before cancelling the browser's tab itself.
  await page.evaluate(() => {
    const seen = window as unknown as { modifierClicks: { href: string | null; cancelled: boolean }[] };
    seen.modifierClicks = [];
    addEventListener("click", event => {
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      seen.modifierClicks.push({ href: anchor?.getAttribute("href") ?? null, cancelled: event.defaultPrevented });
      event.preventDefault();
    }, { once: true });
  });
  await link.click({ modifiers: ["ControlOrMeta"] });
  expect(await page.evaluate(() => (window as unknown as { modifierClicks: unknown[] }).modifierClicks))
    .toEqual([{ href, cancelled: false }]);
  await expect(page).toHaveURL(before);
  expect(page.context().pages()).toEqual([page]);
}
