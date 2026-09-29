import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { viteFsPath } from "./helpers/viteFsPath";
import type { CoachExpression, CoachMotion } from "../src/coach/model";
import type { CoachPerformanceSnapshot } from "../src/coach/performanceDiagnostics";

type Options = {
  seed: number;
  reset: number;
  idle: boolean;
  observe: boolean;
  echo: boolean;
  label: string;
  state: CoachExpression;
  key: string;
  motion: CoachMotion;
};
type DiagnosticsHarness = {
  update: (patch: Partial<Options>) => void;
  snapshots: () => CoachPerformanceSnapshot[];
  clear: () => void;
  mismatches: () => string[];
  unmount: () => void;
  hidden: (value: boolean) => void;
  offscreen: (value: boolean) => void;
  trackMutations: () => void;
  mutations: () => number;
  renders: () => number;
};
type HarnessWindow = Window & { diagnosticsHarness: DiagnosticsHarness };

async function mountDiagnostics(page: Page) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const root = viteFsPath(path.resolve("."));
  await page.evaluate(async (root) => {
    const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const { CoachCharacter } = await import(`${root}/src/coach/CoachAvatar.tsx`);
    const { getCoach } = await import(`${root}/src/coach/registry.ts`);
    const coach = getCoach("classic");
    const container = document.createElement("div");
    container.id = "idle-diagnostics-harness";
    container.style.cssText = "position:fixed;inset:20px auto auto 20px;width:180px;height:220px;z-index:9999";
    document.body.append(container);
    const mounted = createRoot(container);
    let current: Options = {
      seed: 1729, reset: 0, idle: true, observe: true, echo: false, label: "Diagnostics character",
      state: "neutral", key: "move:1", motion: "natural",
    };
    let snapshots: CoachPerformanceSnapshot[] = [];
    const mismatches: string[] = [];
    let observer: MutationObserver | null = null;
    let mutations = 0;
    let renders = 0;
    const observe = (snapshot: CoachPerformanceSnapshot) => {
      snapshots.push(snapshot);
      const avatar = container.querySelector(".coach-avatar");
      const fields = {
        "data-expression": snapshot.expression, "data-phase": snapshot.phase,
        "data-face": snapshot.face, "data-motion": snapshot.motion,
        "data-idles": snapshot.active.map((playing) => playing.gesture.id).join(" "),
      };
      for (const [attribute, expected] of Object.entries(fields)) {
        if (avatar?.getAttribute(attribute) !== expected) {
          mismatches.push(`${attribute}: DOM ${avatar?.getAttribute(attribute)}; snapshot ${expected}`);
        }
      }
    };
    function Host({ options }: { options: Options }) {
      renders++;
      const [, setSnapshot] = React.useState(null);
      return React.createElement(CoachCharacter, {
        coach, reaction: { state: options.state, key: options.key },
        motion: options.motion, idle: options.idle, idleSeed: options.seed,
        idleReset: options.reset, label: options.label,
        // A parent may immediately render diagnostics through an inline setter.
        // Replacing this callback must not emit recursively or restart motion.
        onPerformance: options.observe ? (snapshot: CoachPerformanceSnapshot) => {
          observe(snapshot);
          if (options.echo) setSnapshot(snapshot);
        } : undefined,
      });
    }
    const render = () => mounted.render(React.createElement(Host, { options: current }));
    (window as unknown as HarnessWindow).diagnosticsHarness = {
      update: (patch) => { current = { ...current, ...patch }; render(); },
      snapshots: () => snapshots,
      clear: () => { snapshots = []; },
      mismatches: () => mismatches,
      unmount: () => { observer?.disconnect(); mounted.unmount(); container.remove(); },
      hidden: (value) => {
        if (value) Object.defineProperty(document, "hidden", { configurable: true, value: true });
        else Reflect.deleteProperty(document, "hidden");
        document.dispatchEvent(new Event("visibilitychange"));
      },
      offscreen: (value) => { container.style.left = value ? "-1000px" : "20px"; },
      trackMutations: () => {
        observer?.disconnect();
        mutations = 0;
        observer = new MutationObserver((records) => { mutations += records.length; });
        observer.observe(container.querySelector(".coach-avatar")!, { attributes: true, attributeFilter: ["data-idles"] });
      },
      mutations: () => mutations,
      renders: () => renders,
    };
    render();
  }, root);
  const avatar = page.locator("#idle-diagnostics-harness .coach-avatar");
  await expect(avatar).toBeVisible();
  await expect.poll(() => latest(page).then((snapshot) => snapshot?.paused)).toBe("pending");
  await page.clock.runFor(110);
  await expect.poll(() => latest(page).then((snapshot) => snapshot?.paused)).toBe("reaction");
  await page.clock.runFor(1300);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await expect.poll(() => latest(page).then((snapshot) => snapshot?.paused)).toBe(null);
  return avatar;
}

async function update(page: Page, patch: Partial<Options>) {
  await page.evaluate((patch) => (window as unknown as HarnessWindow).diagnosticsHarness.update(patch), patch);
}
async function snapshots(page: Page) {
  return page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.snapshots());
}
async function latest(page: Page) {
  return (await snapshots(page)).at(-1);
}
async function runClock(page: Page, duration: number) {
  // Leave React's MessageChannel commits room between clock events.
  for (let remaining = duration; remaining > 0; remaining -= 50) {
    await page.clock.runFor(Math.min(remaining, 50));
  }
}
async function awaitActive(page: Page) {
  for (let elapsed = 0; elapsed < 1500; elapsed += 50) {
    if ((await latest(page))?.active.length) return;
    await page.clock.runFor(50);
  }
  expect((await latest(page))?.active.length).toBeGreaterThan(0);
}
function trace(history: CoachPerformanceSnapshot[], origin: number) {
  const started = new Map<number, { id: string; start: number; end: number }>();
  for (const snapshot of history) {
    for (const playing of snapshot.active) {
      if (!started.has(playing.sequence)) started.set(playing.sequence, {
        id: playing.gesture.id,
        start: playing.startedAt - origin,
        end: playing.endsAt - origin,
      });
    }
  }
  return [...started.values()];
}

test("restarting the production coordinator with the same seed repeats its sequence without replaying reactions", async ({ page }) => {
  const avatar = await mountDiagnostics(page);
  const take = await avatar.getAttribute("data-take");
  const originalStart = await page.evaluate(() => performance.now());
  await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.clear());
  await runClock(page, 12_000);
  const original = trace(await snapshots(page), originalStart);
  expect(original.length).toBeGreaterThan(5);
  await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.clear());
  const resetAt = await page.evaluate(() => performance.now());
  await update(page, { reset: 1 });
  await expect(avatar).toHaveAttribute("data-idles", "");
  await expect(avatar).toHaveAttribute("data-take", take!);
  await runClock(page, 12_000);
  expect(trace(await snapshots(page), resetAt)).toEqual(original);
  expect((await snapshots(page)).every((snapshot) => snapshot.phase === "rest" && snapshot.face === "settled")).toBe(true);
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.mismatches())).toEqual([]);
});

test("seed changes immediately mask old tracks and produce a new deterministic sequence", async ({ page }) => {
  const avatar = await mountDiagnostics(page);
  const originalStart = await page.evaluate(() => performance.now());
  await awaitActive(page);
  const take = await avatar.getAttribute("data-take");
  const previous = (await latest(page))!.active;
  expect(previous.length).toBeGreaterThan(0);
  await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.clear());
  const changedAt = await page.evaluate(() => performance.now());
  await update(page, { seed: 83 });
  await expect(avatar).toHaveAttribute("data-idles", "");
  await expect.poll(() => latest(page).then((snapshot) => snapshot?.active)).toEqual([]);
  await expect(avatar).toHaveAttribute("data-take", take!);
  await runClock(page, 10_000);
  const changed = trace(await snapshots(page), changedAt);
  expect(changed.length).toBeGreaterThan(5);
  expect(changed[0].start).toBeGreaterThanOrEqual(500);
  expect(changed[0].start).not.toBe(previous[0].startedAt - originalStart);
  await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.clear());
  const resetAt = await page.evaluate(() => performance.now());
  await update(page, { reset: 1 });
  await runClock(page, 10_000);
  expect(trace(await snapshots(page), resetAt)).toEqual(changed);
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.mismatches())).toEqual([]);
});

test("ordinary rerenders and replacement observers retain active tracks, deadlines and history", async ({ page }) => {
  const avatar = await mountDiagnostics(page);
  await runClock(page, 5000);
  const before = (await latest(page))!;
  expect(before.diagnostics!.recent.length).toBeGreaterThan(0);
  await update(page, { label: "A parent rerender changed this label" });
  await expect(avatar).toHaveAttribute("aria-label", "A parent rerender changed this label");
  const after = (await latest(page))!;
  expect(after.active).toEqual(before.active);
  expect(after.nextAt).toBe(before.nextAt);
  expect(after.diagnostics).toEqual(before.diagnostics);
  await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.trackMutations());
  await update(page, { observe: false });
  const count = (await snapshots(page)).length;
  await runClock(page, 10_000);
  expect((await snapshots(page)).length).toBe(count);
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.mutations())).toBeGreaterThan(5);
  await update(page, { observe: true });
  await expect.poll(() => snapshots(page).then((history) => history.length)).toBeGreaterThan(count);
  expect((await latest(page))!.diagnostics!.recent.length).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.mismatches())).toEqual([]);
});

test("an inline diagnostic state setter stays bounded instead of causing an effect loop", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await mountDiagnostics(page);
  await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.clear());
  const initialRenders = await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.renders());
  await update(page, { echo: true });
  await runClock(page, 10_000);
  const count = (await snapshots(page)).length;
  expect(count).toBeGreaterThan(5);
  const renders = await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.renders());
  // Each new lifecycle snapshot may render its parent once; simply recreating
  // the inline function is not another lifecycle event.
  expect(renders - initialRenders).toBeLessThanOrEqual(count + 2);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.mismatches())).toEqual([]);
});

for (const pause of ["still", "hidden", "offscreen", "disabled"] as const) {
  test(`diagnostics mirror ${pause} suspension and resume without stale active work`, async ({ page }) => {
    const avatar = await mountDiagnostics(page);
    await awaitActive(page);
    const recent = (await latest(page))!.diagnostics!.recent;
    if (pause === "still") await update(page, { motion: "still" });
    if (pause === "disabled") await update(page, { idle: false });
    if (pause === "hidden") await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.hidden(true));
    if (pause === "offscreen") await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.offscreen(true));
    await expect.poll(() => latest(page).then((snapshot) => snapshot?.paused)).toBe(pause);
    await expect(avatar).toHaveAttribute("data-idles", "");
    await page.clock.runFor(50);
    const paused = (await latest(page))!;
    expect(paused.diagnostics!.recent).toEqual(recent);
    await runClock(page, 10_000);
    expect((await latest(page))!.active).toEqual([]);
    expect((await latest(page))!.nextAt).toBe(null);
    expect((await latest(page))!.at).toBe(paused.at);
    expect((await latest(page))!.diagnostics).toEqual(paused.diagnostics);
    if (pause === "still") await update(page, { motion: "natural" });
    if (pause === "disabled") await update(page, { idle: true });
    if (pause === "hidden") await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.hidden(false));
    if (pause === "offscreen") await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.offscreen(false));
    await expect.poll(() => latest(page).then((snapshot) => snapshot?.paused)).toBe(null);
    await expect(avatar).toHaveAttribute("data-idles", "");
    await awaitActive(page);
    expect(await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.mismatches())).toEqual([]);
  });
}

test("unmount ends diagnostic callbacks and scheduled lifecycle work", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const avatar = await mountDiagnostics(page);
  await awaitActive(page);
  await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.unmount());
  const count = (await snapshots(page)).length;
  await runClock(page, 10_000);
  await page.evaluate(() => {
    const harness = (window as unknown as HarnessWindow).diagnosticsHarness;
    harness.hidden(true);
    harness.hidden(false);
  });
  await page.clock.runFor(10_000);
  await expect(avatar).toHaveCount(0);
  expect((await snapshots(page)).length).toBe(count);
  expect(errors).toEqual([]);
});
