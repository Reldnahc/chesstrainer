import { expect, test, type Locator, type Page } from "@playwright/test";
import { classicPerformance } from "../src/coach/classic/performance";
import { IDLE_GAP_MS } from "../src/coach/idleModel";

const clockStepMs = 50;
const reactionMs = classicPerformance.reactionMs?.brilliant ?? classicPerformance.defaultReactionMs;

async function advance(page: Page, durationMs: number) {
  // Give React's MessageChannel commits a turn between timer deadlines.
  for (let remaining = durationMs; remaining > 0; remaining -= clockStepMs) {
    await page.clock.runFor(Math.min(clockStepMs, remaining));
  }
}

async function openStudio(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/?coach=classic&family=storyteller&expression=brilliant");
  const avatar = page.locator(".studio-storyteller .coach-avatar");
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toBeInViewport();
  await page.clock.runFor(110);
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await advance(page, reactionMs);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  return avatar;
}

async function expectQuiet(page: Page, avatar: Locator, durationMs: number) {
  // Check throughout the interval so gestures cannot disappear again before
  // the assertion. The shortest supported gesture spans several clock steps.
  for (let remaining = durationMs; remaining > 0; remaining -= clockStepMs) {
    await page.clock.runFor(Math.min(clockStepMs, remaining));
    await expect(avatar).toHaveAttribute("data-idles", "");
  }
}

async function collectStarts(page: Page, avatar: Locator, count = 8, diagnostics?: Locator) {
  const starts: string[] = [];
  let previous = (await avatar.getAttribute("data-idles") ?? "").split(" ").filter(Boolean);
  const readFrame = () => avatar.evaluate((element, observeDiagnostics) => {
    const region = observeDiagnostics
      ? element.ownerDocument.querySelector('[aria-label="Motion diagnostics"]')
      : null;
    return {
      idles: element.getAttribute("data-idles") ?? "",
      phase: element.getAttribute("data-phase"),
      diagnostics: region ? {
        active: region.getAttribute("data-active"),
        expression: region.getAttribute("data-expression"),
        paused: region.getAttribute("data-paused"),
        nextMs: region.getAttribute("data-next-ms"),
      } : null,
    };
  }, Boolean(diagnostics));
  // This is a bounded virtual-time observation window, not a real-time sleep.
  // Recording starts rather than expecting one exact primitive keeps the test
  // valid when character repertoires are expanded.
  for (let elapsed = 0; elapsed < 20_000 && starts.length < count; elapsed += clockStepMs) {
    await page.clock.runFor(clockStepMs);
    let frame = await readFrame();
    // The observer is delivered through a React effect. A diagnostic repaint
    // may trail the portrait commit, so wait for that handoff only when needed.
    if (diagnostics && frame.diagnostics?.active !== frame.idles) {
      await expect.poll(readFrame).toMatchObject({ diagnostics: { active: frame.idles } });
      frame = await readFrame();
    }
    const active = frame.idles.split(" ").filter(Boolean);
    for (const id of active.filter((id) => !previous.includes(id))) starts.push(id);
    previous = active;
    expect(frame.phase).toBe("rest");
    if (diagnostics) {
      expect(frame.diagnostics).toMatchObject({ active: frame.idles, expression: "brilliant", paused: "" });
      expect(frame.diagnostics?.nextMs).toMatch(/^\d+$/);
      const nextMs = Number(frame.diagnostics?.nextMs);
      expect(Number.isFinite(nextMs)).toBe(true);
      expect(nextMs).toBeGreaterThanOrEqual(0);
    }
  }
  expect(starts.length).toBeGreaterThanOrEqual(count);
  return starts.slice(0, count);
}

test("sustained idle playback is opt-in and keeps cycling without replaying the reaction", async ({ page }) => {
  const avatar = await openStudio(page);
  const natural = page.getByRole("checkbox", { name: "Natural idle playback", exact: true });
  await expect(natural).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Comparison idle playback", exact: true })).not.toBeChecked();
  const take = await avatar.getAttribute("data-take");
  await expectQuiet(page, avatar, 6 * IDLE_GAP_MS[1]);
  await natural.check();
  await avatar.scrollIntoViewIfNeeded();
  const starts = await collectStarts(page, avatar);
  expect(new Set(starts).size).toBeGreaterThanOrEqual(3);
  await expect(avatar).toHaveAttribute("data-take", take!);

  await natural.uncheck();
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toHaveAttribute("data-idles", "");
  await expectQuiet(page, avatar, 3 * IDLE_GAP_MS[1]);
  await expect(avatar).toHaveAttribute("data-take", take!);
});

test("comparison playback is independent of the selected portrait's natural playback", async ({ page }) => {
  const selected = await openStudio(page);
  const natural = page.getByRole("checkbox", { name: "Natural idle playback", exact: true });
  const comparison = page.getByRole("checkbox", { name: "Comparison idle playback", exact: true });
  const compared = page.locator(".studio-comparison-card .coach-avatar").first();

  await comparison.check();
  await expect(natural).not.toBeChecked();
  await compared.scrollIntoViewIfNeeded();
  await expect(compared).toBeInViewport();
  await advance(page, reactionMs + 110);
  await expect(compared).toHaveAttribute("data-phase", "rest");
  expect(new Set(await collectStarts(page, compared, 4)).size).toBeGreaterThanOrEqual(2);

  await selected.scrollIntoViewIfNeeded();
  await expectQuiet(page, selected, 3 * IDLE_GAP_MS[1]);
  await comparison.uncheck();
  await natural.check();
  await expect(comparison).not.toBeChecked();
  await selected.scrollIntoViewIfNeeded();
  await collectStarts(page, selected, 4);
  await compared.scrollIntoViewIfNeeded();
  await expectQuiet(page, compared, 3 * IDLE_GAP_MS[1]);
});

test("diagnostics follow the real portrait and seeded restarts reproduce idles without a new reaction", async ({ page }) => {
  const avatar = await openStudio(page);
  await page.getByRole("checkbox", { name: "Natural idle playback", exact: true }).check();
  await page.getByRole("checkbox", { name: "Show motion diagnostics", exact: true }).check();
  const diagnostics = page.getByRole("region", { name: "Motion diagnostics", exact: true });
  await expect(page.getByRole("spinbutton", { name: "Playback seed", exact: true })).toHaveValue("1729");
  const take = await avatar.getAttribute("data-take");
  const restart = page.getByRole("button", { name: "Restart idle sequence", exact: true });

  const run = async () => {
    await restart.click();
    await expect(avatar).toBeInViewport();
    await expect(avatar).toHaveAttribute("data-phase", "rest");
    await expect(avatar).toHaveAttribute("data-idles", "");
    await expect(diagnostics).toHaveAttribute("data-identity", "classic:storyteller");
    const starts = await collectStarts(page, avatar, 8, diagnostics);
    await expect(avatar).toHaveAttribute("data-take", take!);
    return starts;
  };
  const first = await run();
  expect(new Set(first).size).toBeGreaterThanOrEqual(3);
  expect(await run()).toEqual(first);
});

test("Still pauses the diagnostic coordinator and the portrait even with playback enabled", async ({ page }) => {
  const avatar = await openStudio(page);
  await page.getByRole("checkbox", { name: "Natural idle playback", exact: true }).check();
  await page.getByRole("checkbox", { name: "Show motion diagnostics", exact: true }).check();
  await avatar.scrollIntoViewIfNeeded();
  await collectStarts(page, avatar, 1);
  const take = await avatar.getAttribute("data-take");
  await page.getByRole("combobox", { name: "Motion intensity", exact: true }).selectOption("still");
  await avatar.scrollIntoViewIfNeeded();
  const diagnostics = page.getByRole("region", { name: "Motion diagnostics", exact: true });
  await expect(avatar).toHaveAttribute("data-motion", "still");
  await expect(avatar).toHaveAttribute("data-idles", "");
  await expect(diagnostics).toHaveAttribute("data-paused", "still");
  await expect(diagnostics).toHaveAttribute("data-active", "");
  await expectQuiet(page, avatar, 10 * IDLE_GAP_MS[1]);
  await expect(avatar).toHaveAttribute("data-take", take!);
  expect(await avatar.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
});
