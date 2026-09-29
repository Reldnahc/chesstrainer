import { test, expect, type Locator, type Page } from "@playwright/test";
import path from "node:path";
import { configuredGestures } from "../src/coach/idleGestures";
import { IDLE_GAP_MS, type IdleGesture } from "../src/coach/idleModel";
import type { CoachExpression, CoachIdle } from "../src/coach/model";
import { classicPerformance } from "../src/coach/classic/performance";
import { coachPerformance } from "../src/coach/motionVocabulary";

const cases = [
  { coach: "classic", reaction: 1650 },
  { coach: "cat-black", reaction: 1700 },
  { coach: "dog-collie", reaction: 1700 },
  { coach: "frog", reaction: 1700 },
  { coach: "robot", reaction: 1700 },
  { coach: "slime", reaction: 1700 },
];
const idleGapMs = (IDLE_GAP_MS[0] + IDLE_GAP_MS[1]) / 2;
const clockStepMs = 50;

async function settledCoach(page: Page, coach: string, reaction: number, expression: CoachExpression = "brilliant") {
  // A fixed random source makes cadence reproducible without prescribing which
  // weighted gesture wins as the repertoire grows.
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(`/?coach=${coach}&expression=${expression}`);
  const avatar = page.locator(`.studio-concepts .coach-avatar[data-motion-profile="${coach}"]`);
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toBeInViewport();
  await page.clock.runFor(110);
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await page.clock.runFor(reaction);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  return avatar;
}

type IdleSample = { at: number; ids: CoachIdle[]; phase: string | null; take: string | null; sameArtwork: boolean };
type AuditWindow = Window & { idleSamples: IdleSample[]; stopIdleAudit: () => void };

async function auditIdles(avatar: Locator) {
  await avatar.evaluate((element) => {
    const browser = window as unknown as AuditWindow;
    browser.stopIdleAudit?.();
    const artwork = element.querySelector("svg");
    const read = () => ({
      at: performance.now(),
      ids: (element.getAttribute("data-idles") ?? "").split(" ").filter(Boolean) as CoachIdle[],
      phase: element.getAttribute("data-phase"),
      take: element.getAttribute("data-take"),
      sameArtwork: artwork === element.querySelector("svg"),
    });
    browser.idleSamples = [read()];
    const observer = new MutationObserver(() => browser.idleSamples.push(read()));
    observer.observe(element, { attributes: true, attributeFilter: ["data-idles", "data-phase", "data-take"] });
    browser.stopIdleAudit = () => observer.disconnect();
  });
}

async function samples(page: Page) {
  return page.evaluate(() => (window as unknown as AuditWindow).idleSamples);
}

async function runIdleClock(page: Page, durationMs: number) {
  // React's MessageChannel work is not a clock timer. Small advances let those
  // commits paint between scheduled events instead of batching a whole minute.
  for (let remaining = durationMs; remaining > 0; remaining -= clockStepMs) {
    await page.clock.runFor(Math.min(clockStepMs, remaining));
  }
}

function verifyCycles(timeline: IdleSample[], take: string | null, coachId = "classic", expression: CoachExpression = "brilliant") {
  const definitions: Record<string, IdleGesture> = Object.fromEntries(configuredGestures(
    coachPerformance(coachId, classicPerformance), expression,
  ).map((gesture) => [gesture.id, gesture]));
  const playing = new Map<CoachIdle, number>();
  const completed: CoachIdle[] = [];
  let quietAt = timeline[0].at;
  let previous: CoachIdle[] = [];
  for (const sample of timeline) {
    expect(sample.phase).toBe("rest");
    expect(sample.take).toBe(take);
    expect(sample.sameArtwork).toBe(true);
    expect(sample.ids.length).toBeLessThanOrEqual(2);
    for (const id of previous.filter((id) => !sample.ids.includes(id))) {
      // DOM commits can arrive at the end of this bounded clock step. Scheduler
      // unit tests separately verify exact deadlines without React batching.
      expect(Math.abs(sample.at - playing.get(id)! - definitions[id].durationMs), id).toBeLessThanOrEqual(clockStepMs);
      playing.delete(id);
      completed.push(id);
    }
    if (previous.length && !sample.ids.length) quietAt = sample.at;
    if (!previous.length && sample.ids.length) {
      expect(sample.at - quietAt).toBeGreaterThanOrEqual(IDLE_GAP_MS[0]);
      expect(sample.at - quietAt).toBeLessThanOrEqual(IDLE_GAP_MS[1]);
    }
    for (const id of sample.ids.filter((id) => !previous.includes(id))) playing.set(id, sample.at);
    const channels = sample.ids.flatMap((id) => definitions[id].tracks.map((track) => track.channel));
    expect(new Set(channels).size).toBe(channels.length);
    previous = sample.ids;
  }
  expect(completed.length).toBeGreaterThanOrEqual(5);
  expect(new Set(completed).size).toBeGreaterThanOrEqual(3);
  expect(completed.some((id) => definitions[id].blink)).toBe(true);
}

for (const { coach, reaction } of cases) {
 for (const expression of ["neutral", "brilliant"] as const) {
  test(`${coach} ${expression} keeps autonomous idles alive with real durations and no reaction replay`, async ({ page }) => {
    const duration = expression === "neutral" ? coach === "classic" ? 1300 : 1400 : reaction;
    const avatar = await settledCoach(page, coach, duration, expression);
    const take = await avatar.getAttribute("data-take");
    await auditIdles(avatar);
    await runIdleClock(page, 16_000);
    verifyCycles(await samples(page), take, (await avatar.getAttribute("data-motion-profile"))!, expression);
    await expect(avatar).toHaveAttribute("data-phase", "rest");
    await expect(avatar).toHaveAttribute("data-take", take!);
  });
 }
}

for (const pause of ["still", "reduced", "offscreen", "hidden"]) {
test(`${pause} pauses without catch-up or reaction replay`, async ({ page }) => {
  const avatar = await settledCoach(page, "classic", 1650);
  const take = await avatar.getAttribute("data-take");
  const motion = page.getByRole("combobox", { name: "Motion intensity" });
    await page.clock.runFor(idleGapMs);
    await expect(avatar).toHaveAttribute("data-idles", /.+/);
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
    await expect(avatar).toHaveAttribute("data-idles", "");
    expect(await avatar.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
    await page.clock.runFor(20_000);
    await expect(avatar).toHaveAttribute("data-idles", "");
    if (pause === "still") await motion.selectOption("system");
    if (pause === "reduced") await page.emulateMedia({ reducedMotion: "no-preference" });
    if (pause === "hidden") await page.evaluate(() => {
      Reflect.deleteProperty(document, "hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await avatar.scrollIntoViewIfNeeded();
    await expect(avatar).toHaveAttribute("data-motion", "natural");
    await expect(avatar).toHaveAttribute("data-phase", "rest");
    await expect(avatar).toHaveAttribute("data-take", take!);
    await page.clock.runFor(idleGapMs - 1);
    await expect(avatar).toHaveAttribute("data-idles", "");
    await page.clock.runFor(1);
    await expect(avatar).toHaveAttribute("data-idles", /^\S+$/);
});
}

test("explicit Animated overrides device reduced motion, while Still still stops everything", async ({ page }) => {
  const avatar = await settledCoach(page, "classic", 1650);
  const motion = page.getByRole("combobox", { name: "Motion intensity" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(avatar).toHaveAttribute("data-motion", "still");
  await motion.selectOption("natural");
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toHaveAttribute("data-motion", "natural");
  await auditIdles(avatar);
  const take = await avatar.getAttribute("data-take");
  await runIdleClock(page, 16_000);
  verifyCycles(await samples(page), take);
  await motion.selectOption("still");
  await avatar.scrollIntoViewIfNeeded();
  await page.clock.runFor(20_000);
  await expect(avatar).toHaveAttribute("data-idles", "");
  expect(await avatar.evaluate((element) => element.getAnimations({ subtree: true }).length)).toBe(0);
});

test("pending reactions immediately cancel stale idles and continue with the new expression repertoire", async ({ page }) => {
  const avatar = await settledCoach(page, "classic", 1650);
  await page.clock.runFor(idleGapMs);
  await expect(avatar).toHaveAttribute("data-idles", /.+/);
  await page.getByRole("combobox", { name: "Expression", exact: true }).selectOption("blunder");
  await avatar.scrollIntoViewIfNeeded();
  await expect(avatar).toHaveAttribute("data-idles", "");
  await expect(avatar).toHaveAttribute("data-expression", "blunder");
  await page.clock.runFor(109);
  await expect(avatar).toHaveAttribute("data-idles", "");
  await page.clock.runFor(1);
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await page.clock.runFor(1800);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  const pool = await page.getByRole("combobox", { name: "Idle gesture", exact: true })
    .locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value));
  const take = await avatar.getAttribute("data-take");
  await auditIdles(avatar);
  await runIdleClock(page, 16_000);
  const timeline = await samples(page);
  verifyCycles(timeline, take, "classic", "blunder");
  expect(timeline.flatMap((sample) => sample.ids).every((id) => pool.includes(id) || id === "blink")).toBe(true);
});

test("same-expression navigation cancels stale tracks before its dwell and unmount cancels work", async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => 0.5; });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/");
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const root = `/@fs/${path.resolve(".").replaceAll("\\", "/")}`;
  await page.evaluate(async (root) => {
    // The studio's controls replay a reaction rather than navigating to another
    // chess move. Mount the real shared component to exercise semantic keys.
    const { default: React } = await import(`${root}/node_modules/.vite/deps/react.js`);
    const { default: ReactDOM } = await import(`${root}/node_modules/.vite/deps/react-dom_client.js`);
    const { CoachCharacter } = await import(`${root}/src/coach/CoachAvatar.tsx`);
    const { getCoach } = await import(`${root}/src/coach/registry.ts`);
    const original = getCoach("classic");
    let artworkRenders = 0;
    const coach = { ...original, Artwork: (props: unknown) => {
      artworkRenders++;
      return React.createElement(original.Artwork, props);
    } };
    const container = document.createElement("div");
    container.id = "idle-lifecycle-harness";
    container.style.cssText = "position:fixed;inset:20px auto auto 20px;width:180px;height:220px;z-index:9999";
    document.body.append(container);
    const mounted = ReactDOM.createRoot(container);
    const render = (key: string) => mounted.render(React.createElement(CoachCharacter, {
      coach, reaction: { state: "best", key }, motion: "natural",
    }));
    const browser = window as unknown as { idleHarness: { render: typeof render; unmount: () => void; renders: () => number } };
    browser.idleHarness = { render, renders: () => artworkRenders, unmount: () => { mounted.unmount(); container.remove(); } };
    render("move:1");
  }, root);
  const avatar = page.locator("#idle-lifecycle-harness .coach-avatar");
  await expect(avatar).toBeVisible();
  await page.clock.runFor(110 + 1300);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  const renderCount = () => page.evaluate(() => (window as unknown as { idleHarness: { renders: () => number } }).idleHarness.renders());
  const restingRenders = await renderCount();
  await page.clock.runFor(idleGapMs);
  await expect(avatar).toHaveAttribute("data-idles", /.+/);
  expect(await renderCount()).toBe(restingRenders);
  const take = Number(await avatar.getAttribute("data-take"));
  await page.evaluate(() => (window as unknown as { idleHarness: { render: (key: string) => void } }).idleHarness.render("move:2"));
  await expect(avatar).toHaveAttribute("data-idles", "");
  await expect(avatar).toHaveAttribute("data-expression", "best");
  await page.clock.runFor(109);
  await expect(avatar).toHaveAttribute("data-take", String(take));
  await page.clock.runFor(1);
  await expect(avatar).toHaveAttribute("data-take", String(take + 1));
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  // Cross the canceled idle's finish while the newer entrance still owns motion.
  await page.clock.runFor(1200);
  await expect(avatar).toHaveAttribute("data-phase", "reaction");
  await page.clock.runFor(100);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await page.clock.runFor(idleGapMs);
  await expect(avatar).toHaveAttribute("data-idles", /.+/);
  await page.evaluate(() => (window as unknown as { idleHarness: { unmount: () => void } }).idleHarness.unmount());
  await page.clock.runFor(20_000);
  await expect(avatar).toHaveCount(0);
  expect(errors).toEqual([]);
});
