import { expect, test } from "@playwright/test";

type VisibilityBatch = {
  hold: boolean;
  entries: IntersectionObserverEntry[];
  delivered?: boolean;
  flush: () => void;
};
declare global {
  interface Window {
    coachVisibilityBatch: VisibilityBatch;
  }
}

test("queued visibility changes use the latest position without replaying consumed reactions", async ({ page }) => {
  // Hold real browser observations for one portrait so both scroll directions
  // arrive in one callback, as they can when rendering is busy.
  await page.addInitScript(() => {
    let deliver: (() => void) | undefined;
    const batch: VisibilityBatch = {
      hold: false,
      entries: [],
      flush: () => {
        batch.hold = false;
        deliver?.();
        batch.entries = [];
      },
    };
    window.coachVisibilityBatch = batch;
    const NativeObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        super((entries, observer) => {
          const tracked = entries[0]?.target.matches(".studio-expert .coach-avatar");
          const dispatch = (observations: IntersectionObserverEntry[]) => {
            callback(observations, observer);
            if (tracked) batch.delivered = observations.at(-1)?.isIntersecting;
          };
          if (batch.hold && tracked) {
            batch.entries.push(...entries);
            deliver = () => dispatch(batch.entries);
          } else dispatch(entries);
        }, options);
      }
    };
  });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?coach=classic&family=expert&expression=brilliant");
  const avatar = page.locator(".studio-expert .coach-avatar");
  const replay = page.getByRole("button", { name: "Replay reaction", exact: true });
  const note = page.locator(".studio-note");
  const observations = () => page.evaluate(() =>
    window.coachVisibilityBatch.entries.map((entry) => entry.isIntersecting));
  const hold = () => page.evaluate(() => { window.coachVisibilityBatch.hold = true; });
  const flush = () => page.evaluate(() => window.coachVisibilityBatch.flush());
  const delivered = () => page.evaluate(() => window.coachVisibilityBatch.delivered);

  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toBeInViewport();
  await expect.poll(delivered).toBe(true);
  await page.clock.runFor(110);
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await page.clock.runFor(2000);
  await expect(avatar).toHaveAttribute("data-phase", "rest");

  await hold();
  await note.scrollIntoViewIfNeeded();
  await expect(avatar).not.toBeInViewport();
  await expect.poll(observations).toEqual([false]);
  const take = Number(await avatar.getAttribute("data-take"));
  await replay.click();
  await expect(avatar).toBeInViewport();
  await expect.poll(observations).toEqual([false, true]);
  await page.clock.runFor(110);
  await expect(avatar).toHaveAttribute("data-take", String(take + 1));
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await flush();
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  expect(await avatar.evaluate((element) =>
    element.getAnimations({ subtree: true }).some((animation) => animation.playState === "running"))).toBe(true);
  await page.clock.runFor(2000);
  await expect(avatar).toHaveAttribute("data-phase", "rest");

  // The reverse batch must keep an unplayed reaction paused while offscreen.
  await note.scrollIntoViewIfNeeded();
  await expect(avatar).not.toBeInViewport();
  await expect.poll(delivered).toBe(false);
  await hold();
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toBeInViewport();
  await expect.poll(observations).toEqual([true]);
  await page.getByRole("combobox", { name: "Expression", exact: true }).selectOption("blunder");
  await page.clock.runFor(110);
  await note.scrollIntoViewIfNeeded();
  await expect(avatar).not.toBeInViewport();
  await expect.poll(observations).toEqual([true, false]);
  await flush();
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  expect(await avatar.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);

  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toBeInViewport();
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await page.clock.runFor(2000);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  const consumedTake = await avatar.getAttribute("data-take");
  await note.scrollIntoViewIfNeeded();
  await expect(avatar).not.toBeInViewport();
  await expect.poll(delivered).toBe(false);
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toBeInViewport();
  await expect.poll(delivered).toBe(true);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await expect(avatar).toHaveAttribute("data-take", consumedTake!);
});
