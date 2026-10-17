import { expect, test, type Page } from "../tests/helpers/browserTest";
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
  await page.evaluate(async root => {
    const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const { CoachCharacter } = await import(`${root}/src/coach/CoachCharacter.tsx`);
    const { getCoach } = await import(`${root}/src/coach/registry.ts`);
    const coach = getCoach("classic");
    const container = document.createElement("div");
    container.id = "idle-diagnostics-harness";
    container.style.cssText =
      "position:fixed;inset:20px auto auto 20px;width:180px;height:220px;z-index:9999";
    document.body.append(container);
    const mounted = createRoot(container);
    let current: Options = {
      seed: 1729,
      reset: 0,
      idle: true,
      observe: true,
      echo: false,
      label: "Diagnostics character",
      state: "neutral",
      key: "move:1",
      motion: "natural",
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
        "data-expression": snapshot.expression,
        "data-phase": snapshot.phase,
        "data-face": snapshot.face,
        "data-motion": snapshot.motion,
        "data-idles": snapshot.active.map(playing => playing.gesture.id).join(" "),
      };
      for (const [attribute, expected] of Object.entries(fields)) {
        if (avatar?.getAttribute(attribute) !== expected) {
          mismatches.push(
            `${attribute}: DOM ${avatar?.getAttribute(attribute)}; snapshot ${expected}`,
          );
        }
      }
    };
    function Host({ options }: { options: Options }) {
      renders++;
      const [, setSnapshot] = React.useState(null);
      return React.createElement(CoachCharacter, {
        coach,
        reaction: { state: options.state, key: options.key },
        motion: options.motion,
        idle: options.idle,
        idleSeed: options.seed,
        idleReset: options.reset,
        label: options.label,
        // A parent may immediately render diagnostics through an inline setter.
        // Replacing this callback must not emit recursively or restart motion.
        onPerformance: options.observe
          ? (snapshot: CoachPerformanceSnapshot) => {
              observe(snapshot);
              if (options.echo) setSnapshot(snapshot);
            }
          : undefined,
      });
    }
    const render = () => mounted.render(React.createElement(Host, { options: current }));
    (window as unknown as HarnessWindow).diagnosticsHarness = {
      update: patch => {
        current = { ...current, ...patch };
        render();
      },
      snapshots: () => snapshots,
      clear: () => {
        snapshots = [];
      },
      mismatches: () => mismatches,
      unmount: () => {
        observer?.disconnect();
        mounted.unmount();
        container.remove();
      },
      hidden: value => {
        if (value) Object.defineProperty(document, "hidden", { configurable: true, value: true });
        else Reflect.deleteProperty(document, "hidden");
        document.dispatchEvent(new Event("visibilitychange"));
      },
      offscreen: value => {
        container.style.left = value ? "-1000px" : "20px";
      },
      trackMutations: () => {
        observer?.disconnect();
        mutations = 0;
        observer = new MutationObserver(records => {
          mutations += records.length;
        });
        observer.observe(container.querySelector(".coach-avatar")!, {
          attributes: true,
          attributeFilter: ["data-idles"],
        });
      },
      mutations: () => mutations,
      renders: () => renders,
    };
    render();
  }, root);
  const avatar = page.locator("#idle-diagnostics-harness .coach-avatar");
  await expect(avatar).toBeVisible();
  await expect.poll(() => latest(page).then(snapshot => snapshot?.paused)).toBe("pending");
  await page.clock.runFor(110);
  await expect.poll(() => latest(page).then(snapshot => snapshot?.paused)).toBe("reaction");
  await page.clock.runFor(1300);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await expect.poll(() => latest(page).then(snapshot => snapshot?.paused)).toBe(null);
  return avatar;
}

async function update(page: Page, patch: Partial<Options>) {
  await page.evaluate(
    patch => (window as unknown as HarnessWindow).diagnosticsHarness.update(patch),
    patch,
  );
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

test("ordinary rerenders and replacement observers retain active tracks, deadlines and history", async ({
  page,
}) => {
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
  await page.evaluate(() =>
    (window as unknown as HarnessWindow).diagnosticsHarness.trackMutations(),
  );
  await update(page, { observe: false });
  const count = (await snapshots(page)).length;
  await runClock(page, 10_000);
  expect((await snapshots(page)).length).toBe(count);
  expect(
    await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.mutations()),
  ).toBeGreaterThan(5);
  await update(page, { observe: true });
  await expect.poll(() => snapshots(page).then(history => history.length)).toBeGreaterThan(count);
  expect((await latest(page))!.diagnostics!.recent.length).toBeGreaterThan(0);
  expect(
    await page.evaluate(() => (window as unknown as HarnessWindow).diagnosticsHarness.mismatches()),
  ).toEqual([]);
});
