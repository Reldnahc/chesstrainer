import { expect, test, type Page } from "../tests/helpers/browserTest";
import path from "node:path";
import type { CoachExpression } from "../src/coach/model";
import { speechMouthPoses, type SpeechMouthShape } from "../src/coach/speechMouth";
import { viteFsPath } from "../studio-tests/helpers/viteFsPath";

const coachIds = ["unicorn", "wizard", "dragon", "ghost", "slime", "mushroom"] as const;
const sizes = [92.8, 52.5];
const sheetSelector = "#fantasy-mouth-rig-sheet";
const avatarsSelector = `${sheetSelector} .coach-avatar`;

async function mountCast(page: Page, expressions: CoachExpression[] = ["neutral"]) {
  await page.goto("/");
  await page.evaluate(
    async ({ root, ids, sizes, expressions }) => {
      const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
      const { getCoach } = await import(`${root}/src/coach/registry.ts`);
      await import(`${root}/src/coach/coach.css`);
      const sheet = document.createElement("section");
      sheet.id = "fantasy-mouth-rig-sheet";
      sheet.style.cssText =
        "position:absolute;inset:0 auto auto 0;z-index:9999;background:#151718;color:#eee;padding:20px;display:grid;grid-template-columns:repeat(6,110px);gap:14px;font:11px sans-serif";
      document.body.append(sheet);
      // Render the registered production artwork without an audio source or idle
      // clock. The following samples use the same controls as speech playback.
      createRoot(sheet).render(
        React.createElement(
          React.Fragment,
          null,
          ...expressions.flatMap(expression =>
            sizes.flatMap(size =>
              ids.map(id => {
                const coach = getCoach(id);
                return React.createElement(
                  "figure",
                  {
                    key: `${id}-${size}-${expression}`,
                    style: { margin: 0, display: "grid", justifyItems: "center", gap: 5 },
                  },
                  React.createElement(
                    "div",
                    {
                      className: "coach-avatar",
                      "data-coach": id,
                      "data-size": size,
                      "data-expression": expression,
                      "data-motion": "still",
                      "data-phase": "rest",
                      "data-speaking": "false",
                      "data-articulation": "aligned",
                      style: { width: `${size}px`, height: `${size * 1.25}px` },
                    },
                    React.createElement(coach.Artwork, { expression, family: "storyteller" }),
                  ),
                  React.createElement(
                    "figcaption",
                    null,
                    `${coach.name} · ${size} · ${expression}`,
                  ),
                );
              }),
            ),
          ),
        ),
      );
    },
    { root: viteFsPath(path.resolve(".")), ids: coachIds, sizes, expressions },
  );
  await expect(page.locator(`${avatarsSelector} .speech-mouth-live`)).toHaveCount(
    coachIds.length * sizes.length * expressions.length,
  );
}

async function pose(page: Page, shape: SpeechMouthShape, speaking = true, motion = "natural") {
  await page.locator(avatarsSelector).evaluateAll(
    (nodes, input) => {
      for (const node of nodes) {
        const avatar = node as HTMLElement;
        avatar.dataset.speaking = String(input.speaking);
        avatar.dataset.motion = input.motion;
        for (const [part, value] of Object.entries(input.values)) {
          avatar.style.setProperty(`--speech-${part}`, String(value));
        }
      }
    },
    { values: speechMouthPoses[shape], speaking, motion },
  );
}

async function layerStates(page: Page) {
  return page.locator(avatarsSelector).evaluateAll(nodes =>
    nodes.map(node => {
      const authored = node.querySelector<SVGGElement>(".speech-mouth-authored")!;
      const live = node.querySelector<SVGGElement>(".speech-mouth-live")!;
      const bounds = authored.getBoundingClientRect();
      return {
        key: `${node.getAttribute("data-coach")}-${node.getAttribute("data-size")}-${node.getAttribute("data-expression")}`,
        markup: authored.innerHTML,
        bounds: [bounds.x, bounds.y, bounds.width, bounds.height],
        authoredVisibility:
          (authored.getAnimations().forEach(fade => fade.finish()),
          getComputedStyle(authored).visibility),
        liveVisibility:
          (live.getAnimations().forEach(fade => fade.finish()), getComputedStyle(live).visibility),
      };
    }),
  );
}

test("fantasy speech restores every authored mouth expression exactly when silent or Still", async ({
  page,
}) => {
  // These five expressions exercise smile, grin, ponder, concern and surprise.
  await mountCast(page, ["neutral", "brilliant", "thinking", "mistake", "blunder"]);
  const before = await layerStates(page);
  for (const state of before) {
    expect(state.authoredVisibility, state.key).toBe("visible");
    expect(state.liveVisibility, state.key).toBe("hidden");
    expect(state.markup, state.key).not.toBe("");
  }
  for (const shape of ["open", "round", "closed", "rest"] as const) {
    await pose(page, shape);
    const speaking = await layerStates(page);
    for (const [index, state] of speaking.entries()) {
      expect(state.authoredVisibility, state.key).toBe("hidden");
      expect(state.liveVisibility, state.key).toBe("visible");
      expect(state.markup, state.key).toBe(before[index].markup);
    }
    await pose(page, shape, false);
    expect(await layerStates(page)).toEqual(before);
  }
  // Still wins even if the last active speech controls have not been cleared.
  await pose(page, "open", true, "still");
  expect(await layerStates(page)).toEqual(before);
  const animationCount = await page
    .locator(`${avatarsSelector} .organic-speech-aperture`)
    .evaluateAll(paths => paths.flatMap(path => path.getAnimations()).length);
  expect(animationCount).toBe(0);
});

test("fantasy open, rounded, closed and resting mouths remain readable at application portrait sizes", async ({
  page,
}, info) => {
  await mountCast(page);
  const samples: {
    shape: SpeechMouthShape;
    geometry: {
      id: string;
      size: number;
      width: number;
      height: number;
      path: string;
      opening: string;
      closed: string;
      pressure: string;
    }[];
  }[] = [];
  for (const shape of ["open", "round", "closed", "rest"] as const) {
    await pose(page, shape);
    const geometry = await page.locator(avatarsSelector).evaluateAll(nodes =>
      nodes.map(node => {
        const opening = node.querySelector<SVGGElement>(".organic-speech-opening")!;
        const aperture = opening.querySelector<SVGPathElement>(
          ":scope > .organic-speech-aperture",
        )!;
        const bounds = aperture.getBoundingClientRect();
        return {
          id: node.getAttribute("data-coach")!,
          size: Number(node.getAttribute("data-size")),
          width: bounds.width,
          height: bounds.height,
          path: getComputedStyle(aperture).d,
          opening: getComputedStyle(opening).opacity,
          closed: getComputedStyle(node.querySelector(".organic-speech-closed")!).opacity,
          pressure: getComputedStyle(node.querySelector(".organic-speech-pressure")!).opacity,
        };
      }),
    );
    samples.push({ shape, geometry });
    await page
      .locator(sheetSelector)
      .screenshot({ path: info.outputPath(`fantasy-mouth-${shape}.png`), animations: "allow" });
  }
  for (const id of coachIds)
    for (const size of sizes) {
      const target = (shape: string) =>
        samples
          .find(sample => sample.shape === shape)!
          .geometry.find(sample => sample.id === id && sample.size === size)!;
      const open = target("open");
      const round = target("round");
      expect(open.opening, `${id} ${size} open`).toBe("1");
      expect(open.closed).toBe("0");
      expect(round.opening).toBe("1");
      expect(round.width / round.height, `${id} ${size} rounded aspect`).toBeGreaterThan(0.9);
      expect(round.width / round.height).toBeLessThan(1.4);
      expect(round.width).toBeGreaterThan(1);
      expect(round.height).toBeGreaterThan(1);
      expect(open.width).toBeGreaterThan(round.width * 1.7);
      expect(open.path).not.toBe(round.path);
      for (const shape of ["closed", "rest"]) {
        expect(target(shape).opening).toBe("0");
        expect(target(shape).closed).toBe("1");
        expect(target(shape).height).toBe(0);
      }
      expect(target("closed").pressure).toBe("1");
      expect(target("rest").pressure).toBe("0");
    }
});
