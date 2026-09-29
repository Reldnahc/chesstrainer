import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { viteFsPath } from "./helpers/viteFsPath";
import type { IdleGesture } from "../src/coach/idleModel";

type VisualGesture = Pick<IdleGesture, "id" | "durationMs" | "tracks"> & {
  label?: string;
  description?: string;
};
type VisualCoach = { id: string; name: string };
type Capture = VisualCoach & { gestures: VisualGesture[] };
type VisualHarness = {
  roster: VisualCoach[];
  render: (id: string) => Capture;
  unmount: () => void;
};
type VisualWindow = Window & { coachVisualHarness: VisualHarness };

test("actual-size signature contact sheets retain real tracks and fixed portrait bounds", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  // Both interface sizes are included in each image. The roomy viewport keeps
  // all sixteen portraits visible so their real visibility policy can operate.
  await page.setViewportSize({ width: 1240, height: 1280 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  const moduleRoot = viteFsPath(path.resolve("."));
  await page.evaluate(async root => {
    const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const { CoachCharacter } = await import(`${root}/src/coach/CoachAvatar.tsx`);
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    const { configuredGestures } = await import(`${root}/src/coach/idleGestures.ts`);
    const app = document.getElementById("root");
    if (app) app.style.display = "none";
    const container = document.createElement("main");
    container.id = "coach-visual-harness";
    container.style.cssText = "width:1160px;min-height:0;padding:24px;margin:0 auto;background:#111315;color:#e9edf0;box-sizing:border-box;font-family:Arial,sans-serif";
    const styles = document.createElement("style");
    styles.textContent = `
      #coach-visual-harness h1 { margin:0 0 5px;font-size:24px;line-height:1.2; }
      #coach-visual-harness h2 { margin:0 0 4px;font-size:17px;line-height:1.2; }
      #coach-visual-harness p { margin:0;line-height:1.4; }
      #coach-visual-harness .visual-intro { color:#bac5cf;font-size:12px; }
      #coach-visual-harness .visual-signature { margin-top:20px; }
      #coach-visual-harness .visual-description { color:#bac5cf;font-size:12px; }
      #coach-visual-harness .visual-size-label { margin:13px 0 6px;color:#93b6b0;font-size:11px;letter-spacing:.03em; }
      #coach-visual-harness .visual-grid { display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px; }
      #coach-visual-harness .visual-frame { padding:10px;background:#1b1e21;border:1px solid #394147;border-radius:8px; }
      #coach-visual-harness .visual-scene { display:flex;align-items:center;gap:9px;min-height:126px; }
      #coach-visual-harness .visual-compact .visual-scene { min-height:78px; }
      #coach-visual-harness .visual-portrait { flex:none; }
      #coach-visual-harness .visual-portrait > .coach-avatar { width:100%;height:100%;max-width:none; }
      #coach-visual-harness .visual-bubble { padding:10px;background:#26312d;border:1px solid #4a5952;border-radius:8px;font-size:12px;line-height:1.5; }
      #coach-visual-harness .visual-caption { margin-top:6px;color:#bac5cf;font-size:11px;font-variant-numeric:tabular-nums; }
    `;
    document.head.append(styles);
    document.body.append(container);
    const mounted = createRoot(container);
    const create = React.createElement;
    const fractions = [0, .4, .75, 1];
    const render = (id: string): Capture => {
      const coach = selectableCoaches.find((entry: VisualCoach) => entry.id === id);
      if (!coach) throw new Error(`Missing visual coach: ${id}`);
      const gestures: VisualGesture[] = configuredGestures(coach.animation, "neutral")
        .filter((entry: IdleGesture) => entry.id === "signature-a" || entry.id === "signature-b");
      const frame = (gesture: VisualGesture, size: number, fraction: number) => create("article", {
        className: "visual-frame", key: fraction,
        "data-gesture": gesture.id, "data-fraction": fraction, "data-size": size,
      },
      create("div", { className: "visual-scene" },
        create("div", { className: "visual-portrait", style: { width: `${size}px`, height: `${size * 1.25}px` } },
          create(CoachCharacter, {
            coach, reaction: { state: "neutral", key: `${id}:${gesture.id}:${size}:${fraction}` },
            motion: "natural", previewIdle: gesture.id, idle: false,
            label: `${coach.name}: ${gesture.label}`,
          })),
        create("p", { className: "visual-bubble" }, "Ready for your next move.")),
      create("p", { className: "visual-caption" },
        `${fraction === 0 ? "Start" : fraction === 1 ? "End" : `${fraction * 100}%`} · ${Math.round(gesture.durationMs * fraction)} ms`));
      const sizeRow = (gesture: VisualGesture, size: number) => create("div", {
        className: size === 52.5 ? "visual-compact" : "", key: size,
      },
      create("p", { className: "visual-size-label" }, `${size === 92.8 ? "DESKTOP" : "COMPACT"} · ${size} PX PORTRAIT`),
      create("div", { className: "visual-grid" }, ...fractions.map(fraction => frame(gesture, size, fraction))));
      const section = (gesture: VisualGesture) => create("section", {
        className: "visual-signature", key: gesture.id,
      },
      create("h2", null, gesture.label ?? gesture.id),
      create("p", { className: "visual-description" }, gesture.description ?? ""),
      ...[92.8, 52.5].map(size => sizeRow(gesture, size)));
      mounted.render(create("div", { key: id },
        create("h1", null, coach.name),
        create("p", { className: "visual-intro" }, `${id} · Neutral expression · Actual production portraits and idle tracks`),
        ...gestures.map(section),
      ));
      return { id, name: coach.name, gestures };
    };
    (window as unknown as VisualWindow).coachVisualHarness = {
      roster: selectableCoaches.map(({ id, name }: VisualCoach) => ({ id, name })),
      render,
      unmount: () => {
        mounted.unmount();
        container.remove();
        styles.remove();
        if (app) app.style.removeProperty("display");
      },
    };
  }, moduleRoot);

  const roster = await page.evaluate(() => (window as unknown as VisualWindow).coachVisualHarness.roster);
  expect(roster.length).toBeGreaterThan(0);
  const output = path.resolve("..", "data", "verification", "coach-idle-visual", testInfo.project.name);
  await mkdir(output, { recursive: true });
  const harness = page.locator("#coach-visual-harness");
  try {
    for (const coach of roster) {
      const capture = await page.evaluate(id => (window as unknown as VisualWindow).coachVisualHarness.render(id), coach.id);
      expect(capture.gestures.map(gesture => gesture.id)).toEqual(["signature-a", "signature-b"]);
      const avatars = harness.locator(`.coach-avatar[data-coach="${coach.id}"]`);
      await expect(avatars).toHaveCount(16);
      await expect(avatars.last()).toBeInViewport();
      await page.clock.runFor(110);
      await expect(harness.locator('.coach-avatar[data-idles="signature-a"]')).toHaveCount(8);
      await expect(harness.locator('.coach-avatar[data-idles="signature-b"]')).toHaveCount(8);

      const sampled = await avatars.evaluateAll((elements, gestures) => elements.map(element => {
        const frame = element.closest<HTMLElement>(".visual-frame")!;
        const definition = gestures.find(gesture => gesture.id === frame.dataset.gesture)!;
        const fraction = Number(frame.dataset.fraction);
        const artwork = element.querySelector("svg");
        const before = element.getBoundingClientRect().toJSON();
        const animations = element.getAnimations({ subtree: true });
        const tracks = animations.map(animation => {
          const timing = animation.effect!.getTiming();
          animation.pause();
          // Seek the browser's authored animation, including its own delay.
          // The JS clock remains at the preview start, preventing its cleanup.
          animation.currentTime = definition.durationMs * fraction;
          return {
            name: (animation as CSSAnimation).animationName,
            duration: timing.duration, delay: timing.delay,
          };
        });
        // Force style resolution at the sampled frame before comparing bounds.
        if (artwork) void getComputedStyle(artwork).transform;
        return {
          gesture: definition.id, fraction, tracks, before, size: Number(frame.dataset.size),
          after: element.getBoundingClientRect().toJSON(),
          sameArtwork: artwork === element.querySelector("svg"),
          phase: element.getAttribute("data-phase"),
          face: element.getAttribute("data-face"),
        };
      }), capture.gestures);
      for (const sample of sampled) {
        expect(sample.phase).toBe("rest");
        expect(sample.face).toBe("settled");
        expect(sample.sameArtwork).toBe(true);
        expect(sample.after).toEqual(sample.before);
        expect(sample.before.width).toBeCloseTo(sample.size, 1);
        expect(sample.before.height).toBeCloseTo(sample.size * 1.25, 1);
        expect(sample.tracks.length).toBeGreaterThan(0);
        expect(sample.tracks.every(track => track.name.startsWith("coach-idle-"))).toBe(true);
        for (const track of capture.gestures.find(gesture => gesture.id === sample.gesture)!.tracks) {
          expect(sample.tracks, `${coach.id}:${sample.gesture}:${track.channel}`).toContainEqual({
            name: track.keyframes, duration: track.durationMs, delay: track.delayMs ?? 0,
          });
        }
      }
      const screenshot = path.join(output, `${coach.id}.png`);
      await harness.screenshot({ path: screenshot, animations: "allow", caret: "hide" });
      await testInfo.attach(`${coach.name} signature frames`, { path: screenshot, contentType: "image/png" });
    }
  } finally {
    await page.evaluate(() => (window as unknown as VisualWindow).coachVisualHarness.unmount());
  }
  expect(errors).toEqual([]);
});
