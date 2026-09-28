import { test, expect, type Page } from "@playwright/test";

const cases = [
  { coach: "classic", reaction: 1650 },
  { coach: "woman", reaction: 1700 },
  { coach: "cat", reaction: 1700 },
  { coach: "dog", reaction: 1700 },
];
const idleGapMs = 750;

async function settledCoach(page: Page, coach: string, reaction: number) {
  // Fix the random draw at the documented range midpoint and advance actual
  // application timers, without real sleeps or changes to the scheduler.
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/?coach=${coach}&expression=brilliant`);
  const avatar = page.locator(".studio-concepts .coach-avatar").first();
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toBeInViewport();
  await page.clock.runFor(110);
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await page.clock.runFor(reaction);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  return avatar;
}

for (const { coach, reaction } of cases) {
  test(`${coach} keeps cycling existing idles at the natural and subtle cadence`, async ({ page }) => {
    const avatar = await settledCoach(page, coach, reaction);
    const take = await avatar.getAttribute("data-take");
    for (let cycle = 0; cycle < 3; cycle++) {
      await page.clock.runFor(idleGapMs - 1);
      await expect(avatar).toHaveAttribute("data-micro", "");
      await page.clock.runFor(1);
      await expect(avatar).toHaveAttribute("data-micro", /.+/);
      const gesture = await avatar.getAttribute("data-micro");
      await expect(avatar).toHaveAttribute("data-phase", "rest");
      await expect(avatar).toHaveAttribute("data-take", take!);
      await page.clock.runFor(1199);
      await expect(avatar).toHaveAttribute("data-micro", gesture!);
      await page.clock.runFor(1);
      await expect(avatar).toHaveAttribute("data-micro", "");
    }
    await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("subtle");
    await avatar.scrollIntoViewIfNeeded();
    await expect(avatar).toHaveAttribute("data-motion", "subtle");
    await page.clock.runFor(idleGapMs - 1);
    await expect(avatar).toHaveAttribute("data-micro", "");
    await page.clock.runFor(1);
    await expect(avatar).toHaveAttribute("data-micro", /.+/);
    await expect(avatar).toHaveAttribute("data-phase", "rest");
    await expect(avatar).toHaveAttribute("data-take", take!);
  });
}

test("idle pauses for Still, reduced motion, offscreen and hidden tabs without replaying reactions", async ({ page }) => {
  const avatar = await settledCoach(page, "classic", 1650);
  const take = await avatar.getAttribute("data-take");
  const motion = page.getByRole("combobox", { name: "Motion intensity" });
  for (const pause of ["still", "reduced", "offscreen", "hidden"]) {
    await page.clock.runFor(idleGapMs);
    await expect(avatar).toHaveAttribute("data-micro", /.+/);
    if (pause === "still") {
      await motion.selectOption("still");
      await avatar.scrollIntoViewIfNeeded();
      await expect(avatar).toHaveAttribute("data-motion", "still");
    } else if (pause === "reduced") {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await expect(avatar).toHaveAttribute("data-motion", "still");
    } else if (pause === "offscreen") {
      await page.locator(".studio-note").scrollIntoViewIfNeeded();
      await expect(avatar).not.toBeInViewport();
    } else {
      await page.evaluate(() => {
        Object.defineProperty(document, "hidden", { configurable: true, value: true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }
    await expect(avatar).toHaveAttribute("data-micro", "");
    // Cross two complete idle windows, including the cancelled gesture's finish.
    for (let cycle = 0; cycle < 2; cycle++) {
      await page.clock.runFor(idleGapMs);
      await expect(avatar).toHaveAttribute("data-micro", "");
      await page.clock.runFor(1200);
      await expect(avatar).toHaveAttribute("data-micro", "");
    }
    if (pause === "still") await motion.selectOption("natural");
    if (pause === "reduced") await page.emulateMedia({ reducedMotion: "no-preference" });
    if (pause === "hidden") await page.evaluate(() => {
      Reflect.deleteProperty(document, "hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await avatar.scrollIntoViewIfNeeded();
    await expect(avatar).toHaveAttribute("data-motion", "natural");
    await expect(avatar).toHaveAttribute("data-phase", "rest");
    await expect(avatar).toHaveAttribute("data-take", take!);
  }
  await page.clock.runFor(idleGapMs);
  await expect(avatar).toHaveAttribute("data-micro", /.+/);
});
