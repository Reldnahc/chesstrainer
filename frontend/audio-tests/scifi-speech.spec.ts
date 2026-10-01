import {expect, test, type Page} from "@playwright/test";
import path from "node:path";
import {speechMouthPoses, type SpeechMouthShape} from "../src/coach/speechMouth";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";

async function mountCast(page: Page) {
  await page.goto("/");
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await page.evaluate(async root => {
    const {React, createRoot} = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const {default: Alien} = await import(`${root}/src/coach/cast/scifi/AlienCoach.tsx`);
    const {default: Robot} = await import(`${root}/src/coach/cast/scifi/RobotCoach.tsx`);
    const {default: Pawn} = await import(`${root}/src/coach/cast/scifi/LivingPawnCoach.tsx`);
    const container = document.createElement("div");
    container.id = "scifi-speech-preview";
    container.style.cssText = "position:fixed;inset:0;z-index:9999;background:#15191c;overflow:auto;display:flex;gap:28px;align-items:flex-start;padding:28px;flex-wrap:wrap";
    document.body.append(container);
    createRoot(container).render(React.createElement(React.Fragment, null,
      ...[["alien", Alien], ["robot", Robot], ["living-pawn", Pawn]].flatMap(([id, Artwork]) => [92.8, 52.5].map(size =>
        React.createElement("div", {key: `${id}-${size}`, className: "coach-avatar", "data-preview": `${id}-${size}`,
          "data-speaking": "false", "data-motion": "natural", "data-articulation": "aligned",
          style: {width: `${size}px`, height: `${size * 1.25}px`, flex: "0 0 auto"}},
          React.createElement(Artwork, {expression: "neutral", family: "storyteller"}))))));
  }, viteFsPath(path.resolve(".")));
  await expect(page.locator("#scifi-speech-preview .speech-mouth-live")).toHaveCount(6);
}

async function pose(page: Page, shape: SpeechMouthShape, speaking = true, motion = "natural") {
  await page.locator("#scifi-speech-preview .coach-avatar").evaluateAll((nodes, input) => {
    for (const node of nodes) {
      const element = node as HTMLElement;
      element.dataset.speaking = String(input.speaking);
      element.dataset.motion = input.motion;
      for (const [part, value] of Object.entries(input.values)) element.style.setProperty(`--speech-${part}`, String(value));
    }
  }, {values: speechMouthPoses[shape], speaking, motion});
}

test("scifi speech layers preserve authored faces when silent or Still", async ({page}) => {
  await mountCast(page);
  const avatars = page.locator("#scifi-speech-preview .coach-avatar");
  for (const avatar of await avatars.all()) {
    await expect(avatar.locator(".speech-mouth-authored")).toBeVisible();
    await expect(avatar.locator(".speech-mouth-live")).not.toBeVisible();
  }
  await pose(page, "wide");
  for (const avatar of await avatars.all()) {
    await expect(avatar.locator(".speech-mouth-authored")).not.toBeVisible();
    await expect(avatar.locator(".speech-mouth-live")).toBeVisible();
  }
  await pose(page, "wide", true, "still");
  for (const avatar of await avatars.all()) {
    await expect(avatar.locator(".speech-mouth-authored")).toBeVisible();
    await expect(avatar.locator(".speech-mouth-live")).not.toBeVisible();
  }
});

test("Rivet's display articulates closed, open and rounded sounds while retaining its lenses and scanline", async ({page}, info) => {
  await mountCast(page);
  const robot = page.locator('[data-preview="robot-92.8"]');
  const opening = robot.locator(".robot-speech-opening");
  await pose(page, "closed");
  await expect(opening).toHaveCSS("opacity", "0");
  await expect(robot.locator(".robot-speech-closed")).toHaveCSS("opacity", "1");
  await expect(robot.locator(".robot-speech-pressure")).toHaveCSS("opacity", "1");
  await pose(page, "wide");
  await expect(opening).toHaveCSS("opacity", "1");
  const wide = await robot.locator(".robot-speech-opening > .robot-speech-aperture").boundingBox();
  await pose(page, "pucker");
  const round = await robot.locator(".robot-speech-opening > .robot-speech-aperture").boundingBox();
  expect(wide!.width).toBeGreaterThan(round!.width * 2);
  expect(wide!.height).toBeGreaterThan(round!.height);
  expect(round!.height).toBeGreaterThan(round!.width * .5);
  await expect(robot.locator(".cast-lens")).toHaveCount(2);
  await expect(robot.locator(".cast-scanline")).toHaveCount(1);
  await expect(robot.locator(".robot-speech-mouth .organic-speech-mouth")).toHaveCount(0);
  await page.locator("#scifi-speech-preview").screenshot({path: info.outputPath("scifi-speech-rounded.png")});
  await pose(page, "wide");
  await page.locator("#scifi-speech-preview").screenshot({path: info.outputPath("scifi-speech-wide.png")});
});

test("Ziggy and Percy's live mouths remain inside their faces at both application sizes", async ({page}) => {
  await mountCast(page);
  for (const shape of Object.keys(speechMouthPoses) as SpeechMouthShape[]) {
    await pose(page, shape);
    for (const [id, maximum] of [["alien", 82], ["living-pawn", 58]] as const) {
      for (const size of [92.8, 52.5]) {
        const avatar = page.locator(`[data-preview="${id}-${size}"]`);
        const svg = await avatar.locator("svg").boundingBox();
        const mouth = await avatar.locator(".speech-mouth-live").boundingBox();
        expect(mouth!.x).toBeGreaterThan(svg!.x + svg!.width * .25);
        expect(mouth!.x + mouth!.width).toBeLessThan(svg!.x + svg!.width * .75);
        expect(mouth!.y + mouth!.height).toBeLessThanOrEqual(svg!.y + svg!.height * maximum / 125);
      }
    }
  }
});
