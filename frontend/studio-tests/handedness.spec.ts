import { expect, test } from "@playwright/test";
import path from "node:path";
import { viteFsPath } from "./helpers/viteFsPath";
import type { CoachExpression, SelectableCoach } from "../src/coach/model";

type HandednessWindow = Window & { unmountHandedness: () => void };

test("paired hands retain opposite chirality and wrist attachments through every expression and motion layer", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const root = viteFsPath(path.resolve("."));
  const roster = await page.evaluate(async root => {
    const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
    const { expressions } = await import(`${root}/src/coach/model.ts`);
    const others = ["robot", "alien", "living-pawn", "wizard", "dragon", "gorilla", "raccoon", "frog", "capybara"];
    const coaches: SelectableCoach[] = selectableCoaches.filter((coach: SelectableCoach) =>
      coach.group === "humans" || others.includes(coach.id));
    const container = document.createElement("div");
    container.id = "handedness-fixture";
    container.style.cssText = "display:grid;grid-template-columns:repeat(10,100px);gap:4px";
    document.body.append(container);
    const mounted = createRoot(container);
    // Exercise registered production artwork with its real CSS. The existing
    // lifecycle suites own timing; deterministic phases here isolate geometry.
    mounted.render(React.createElement(React.Fragment, null, ...coaches.flatMap(coach =>
      expressions.map((expression: CoachExpression) => React.createElement("div", {
        key: `${coach.id}:${expression}`,
        className: "coach-avatar",
        "data-coach": coach.id,
        "data-family": coach.defaultFamily,
        "data-expression": expression,
        "data-motion": "still",
        "data-phase": "rest",
        style: { width: 100, height: 125 },
      }, React.createElement(coach.Artwork, { expression, family: coach.defaultFamily }))))));
    (window as unknown as HandednessWindow).unmountHandedness = () => {
      mounted.unmount();
      container.remove();
    };
    return { ids: coaches.map(coach => coach.id), expressions: expressions.length };
  }, root);
  try {
    expect(roster.ids).toEqual(expect.arrayContaining([
      "classic", "human-boy", "human-girl", "wizard", "robot", "alien", "living-pawn",
      "gorilla", "raccoon", "frog", "capybara", "dragon",
    ]));
    const portraits = page.locator("#handedness-fixture .coach-avatar");
    await expect(portraits).toHaveCount(roster.ids.length * roster.expressions);
    const result = await page.evaluate(async root => {
      const { selectableCoaches } = await import(`${root}/src/coach/registry.ts`);
      const { configuredGestures, idleTrackStyle } = await import(`${root}/src/coach/idleGestures.ts`);
      const portraits = [...document.querySelectorAll<HTMLElement>("#handedness-fixture .coach-avatar")];
      const failures: string[] = [];
      let hands = 0;
      let reactionAnimations = 0;
      let idleAnimations = 0;
      const close = (actual: number, expected: number) => Math.abs(actual - expected) < .001;
      const inspect = (portrait: HTMLElement, phase: string) => {
        const id = portrait.dataset.coach!;
        const human = !!portrait.querySelector(".coach-arm");
        const mirrorLeft = ["wizard", "robot", "alien", "living-pawn"].includes(id);
        const offset = human ? 5 : id === "wizard" ? 4 : mirrorLeft ? 0 : 3;
        for (const side of ["left", "right"]) {
          const label = `${id}:${portrait.dataset.expression}:${phase}:${side}`;
          const arm = portrait.querySelector<SVGGElement>(human ? `.coach-arm-${side}` : `.study-paw-${side}`);
          const wrist = arm?.querySelector<SVGGElement>('g[transform^="translate("]');
          const placement = wrist?.getAttribute("transform")?.match(/^translate\(([-\d.]+) ([-\d.]+)\) rotate\(([-\d.]+)\)/);
          const sleeve = arm?.querySelector<SVGPathElement>('path[fill="none"][stroke-width]');
          const outline = human ? wrist?.querySelector<SVGPathElement>(".coach-hand > path")
            : id === "wizard" ? wrist?.querySelector<SVGPathElement>('path[fill="#dba786"]')
              : wrist?.querySelector<SVGGraphicsElement>("path, rect");
          if (!arm || !wrist || !placement || !sleeve || !outline) {
            failures.push(`${label}: missing arm, placement, sleeve or hand geometry`);
            continue;
          }
          const parent = wrist.parentElement as unknown as SVGGraphicsElement;
          const placementMatrix = parent.getCTM()!.translate(Number(placement[1]), Number(placement[2]))
            .rotate(Number(placement[3]));
          const local = placementMatrix.inverse().multiply(outline.getCTM()!);
          const direction = side === (mirrorLeft ? "left" : "right") ? -1 : 1;
          if (![close(local.a, direction), close(local.b, 0), close(local.c, 0), close(local.d, 1),
            close(local.e, 0), close(local.f, 0)].every(Boolean)) {
            failures.push(`${label}: hand must reflect at its wrist, independently of the posed/animated arm`);
          }
          // The sleeve ends a small authored distance past the wrist origin.
          // A whole-limb reflection or lost translation detaches that joint.
          const joint = new DOMPoint(0, 0).matrixTransform(sleeve.getCTM()!.inverse().multiply(wrist.getCTM()!));
          const endpoint = sleeve.getPointAtLength(sleeve.getTotalLength());
          if (!close(endpoint.x, joint.x) || !close(endpoint.y - joint.y, offset)) {
            failures.push(`${label}: sleeve no longer meets its authored wrist`);
          }
          // Finger creases/claws must use the outline's orientation too.
          const details = [...wrist.querySelectorAll<SVGGraphicsElement>("path, rect")]
            .filter(node => node !== outline && node.getAttribute("d") !== "M-4 5h8v3h-8Z"
              && node.getAttribute("d") !== "M-6 7h12v6H-6Z");
          if (details.some(detail => !close(placementMatrix.inverse().multiply(detail.getCTM()!).a, direction))) {
            failures.push(`${label}: hand details are reflected differently from the silhouette`);
          }
          hands++;
        }
      };
      const sampleAnimations = (portrait: HTMLElement) => {
        const animations = portrait.getAnimations({ subtree: true });
        for (const animation of animations) {
          animation.pause();
          const timing = animation.effect!.getTiming();
          animation.currentTime = Number(timing.delay) + Number(timing.duration) * .4;
        }
        return animations.length;
      };
      for (const portrait of portraits) inspect(portrait, "still");
      for (const portrait of portraits) {
        portrait.dataset.motion = "natural";
        portrait.dataset.phase = "reaction";
        reactionAnimations += sampleAnimations(portrait);
        inspect(portrait, "reaction");
        portrait.dataset.phase = "rest";
        const coach = selectableCoaches.find((coach: SelectableCoach) => coach.id === portrait.dataset.coach)!;
        const gestures = configuredGestures(coach.animation, portrait.dataset.expression as CoachExpression);
        const gesture = gestures.find((entry: { tracks: { channel: string }[] }) =>
          entry.tracks.some(track => /(?:Arm|Paw)$/.test(track.channel)))
          ?? gestures.find((entry: { tracks: { channel: string }[] }) => entry.tracks.some(track => track.channel === "body"));
        if (gesture) {
          for (const [property, value] of Object.entries(idleTrackStyle([{ gesture }]))) {
            portrait.style.setProperty(property, String(value));
          }
          portrait.dataset.idles = gesture.id;
          idleAnimations += sampleAnimations(portrait);
          inspect(portrait, `idle:${gesture.id}`);
        }
        portrait.dataset.motion = "still";
      }
      return { failures, hands, reactionAnimations, idleAnimations };
    }, root);
    expect(result.failures).toEqual([]);
    expect(result.hands).toBeGreaterThanOrEqual(roster.ids.length * roster.expressions * 4);
    expect(result.reactionAnimations).toBeGreaterThan(0);
    expect(result.idleAnimations).toBeGreaterThan(0);
  } finally {
    await page.evaluate(() => (window as unknown as HandednessWindow).unmountHandedness());
  }
});
