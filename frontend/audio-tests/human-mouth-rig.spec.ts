import { expect, test, type Page } from "../tests/helpers/browserTest";
import path from "node:path";
import type { CoachExpression } from "../src/coach/model";
import { speechMouthPoses, type SpeechMouthShape } from "../src/coach/speechMouth";
import { viteFsPath } from "../studio-tests/helpers/viteFsPath";

// Walter keeps his dedicated rig; the other nine humans share one mouth placed on
// his face coordinates. He is mounted beside them so every sheet compares the two.
const humanIds = [
  "man-host",
  "man-expert",
  "man-partner",
  "woman-captain",
  "woman-analyst",
  "woman-spark",
  "woman-blonde",
  "human-boy",
  "human-girl",
] as const;
const coachIds = ["classic", ...humanIds] as const;
const sizes = [92.8, 52.5];
const sheetSelector = "#human-mouth-rig-sheet";
const avatarsSelector = `${sheetSelector} .coach-avatar`;
const humansSelector = `${avatarsSelector}:not([data-coach="classic"])`;

async function mountCast(page: Page, expressions: CoachExpression[]) {
  await page.goto("/");
  await page.evaluate(
    async ({ root, ids, sizes, expressions }) => {
      const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
      const { getCoach } = await import(`${root}/src/coach/registry.ts`);
      await import(`${root}/src/coach/coach.css`);
      const sheet = document.createElement("section");
      sheet.id = "human-mouth-rig-sheet";
      sheet.style.cssText =
        "position:absolute;inset:0 auto auto 0;z-index:9999;background:#151718;color:#eee;padding:20px;display:grid;grid-template-columns:repeat(10,110px);gap:14px;font:11px sans-serif";
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
                      "data-family": coach.defaultFamily,
                      "data-size": size,
                      "data-expression": expression,
                      "data-motion": "still",
                      "data-phase": "rest",
                      "data-speaking": "false",
                      "data-articulation": "aligned",
                      style: { width: `${size}px`, height: `${size * 1.25}px` },
                    },
                    React.createElement(coach.Artwork, { expression, family: coach.defaultFamily }),
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
    humanIds.length * sizes.length * expressions.length,
  );
  await expect(
    page.locator(`${avatarsSelector}[data-coach="classic"] .walter-aligned-mouth`),
  ).toHaveCount(sizes.length * expressions.length);
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
  return page.locator(humansSelector).evaluateAll(nodes =>
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
        jaw: [...node.querySelectorAll(".human-speech-jaw")].map(
          group => getComputedStyle(group).transform,
        ),
      };
    }),
  );
}

test("human speech restores every authored mouth expression exactly when silent or Still", async ({
  page,
}) => {
  // These five expressions exercise smile, grin, ponder, concern and surprise.
  await mountCast(page, ["neutral", "brilliant", "thinking", "mistake", "blunder"]);
  const before = await layerStates(page);
  for (const state of before) {
    expect(state.authoredVisibility, state.key).toBe("visible");
    expect(state.liveVisibility, state.key).toBe("hidden");
    expect(state.markup, state.key).not.toBe("");
    expect(state.markup, state.key).toContain('class="coach-mouth"');
    for (const jaw of state.jaw) expect(jaw, state.key).toBe("none");
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
