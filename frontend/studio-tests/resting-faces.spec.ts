import { expect, test, type Locator, type Page } from "../tests/helpers/browserTest";
import path from "node:path";
import { viteFsPath } from "./helpers/viteFsPath";
import type { CoachExpression, CoachMotion } from "../src/coach/model";

type FaceOptions = {
  coach: string;
  state: CoachExpression;
  key: string;
  motion: CoachMotion;
  previewIdle: string;
  replay: number;
};
type FaceObservation = { face: string | null; eyes: (string | null)[] };
type FaceHarness = {
  update: (patch: Partial<FaceOptions>) => void;
  duration: () => number;
  observe: () => void;
  observations: () => FaceObservation[];
  rememberArtwork: () => void;
  sameArtwork: () => boolean;
};
type HarnessWindow = Window & { faceHarness: FaceHarness };

async function mountFace(page: Page, options: Partial<FaceOptions> = {}) {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await page.getByRole("combobox", { name: "Motion intensity" }).selectOption("still");
  const root = viteFsPath(path.resolve("."));
  await page.evaluate(
    async ({ root, options }) => {
      // Use the real shared component; the studio does not expose reaction-key
      // toggles, which are essential interruption cases here.
      const { React, createRoot } = await import(`${root}/studio-tests/fixtures/runtime.ts`);
      const { CoachCharacter } = await import(`${root}/src/coach/CoachCharacter.tsx`);
      const { getCoach } = await import(`${root}/src/coach/registry.ts`);
      let current: FaceOptions = {
        coach: "classic",
        state: "good",
        key: "move:1",
        motion: "natural",
        previewIdle: "",
        replay: 0,
        ...options,
      };
      const container = document.createElement("div");
      container.id = "resting-face-harness";
      container.style.cssText =
        "position:fixed;inset:20px auto auto 20px;width:180px;height:220px;z-index:9999";
      document.body.append(container);
      const mounted = createRoot(container);
      let observed: FaceObservation[] = [];
      let observer: MutationObserver | null = null;
      let artwork: Element | null = null;
      const avatar = () => container.querySelector(".coach-avatar")!;
      const render = () => {
        mounted.render(
          React.createElement(CoachCharacter, {
            coach: getCoach(current.coach),
            reaction: { state: current.state, key: current.key },
            motion: current.motion,
            replay: current.replay,
            previewIdle: current.previewIdle,
            idle: false,
          }),
        );
      };
      (window as unknown as HarnessWindow).faceHarness = {
        update: patch => {
          current = { ...current, ...patch };
          render();
        },
        duration: () => {
          const animation = getCoach(current.coach).animation;
          return animation.reactionMs[current.state] ?? animation.defaultReactionMs;
        },
        observe: () => {
          observer?.disconnect();
          const read = () => ({
            face: avatar().getAttribute("data-face"),
            eyes: [...avatar().querySelectorAll("[data-eye-state]")].map(eye =>
              eye.getAttribute("data-eye-state"),
            ),
          });
          observed = [read()];
          observer = new MutationObserver(() => observed.push(read()));
          observer.observe(avatar(), { attributes: true, childList: true, subtree: true });
        },
        observations: () => observed,
        rememberArtwork: () => {
          artwork = avatar().querySelector("svg");
        },
        sameArtwork: () => artwork === avatar().querySelector("svg"),
      };
      render();
    },
    { root, options },
  );
  const avatar = page.locator("#resting-face-harness .coach-avatar");
  await expect(avatar).toBeVisible();
  return avatar;
}

async function update(page: Page, patch: Partial<FaceOptions>) {
  await page.evaluate(
    patch => (window as unknown as HarnessWindow).faceHarness.update(patch),
    patch,
  );
}
async function duration(page: Page) {
  return page.evaluate(() => (window as unknown as HarnessWindow).faceHarness.duration());
}
async function eyeState(avatar: Locator, state: "closed" | "open") {
  await expect
    .poll(() =>
      avatar
        .locator("[data-eye-state]")
        .evaluateAll(eyes => eyes.map(eye => eye.getAttribute("data-eye-state"))),
    )
    .toEqual((await avatar.locator("[data-eye-state]").all()).map(() => state));
  expect(await avatar.locator("[data-eye-state]").count()).toBeGreaterThan(0);
}
async function nonEyeGeometry(avatar: Locator) {
  return avatar.locator("svg").evaluate(svg => {
    const clone = svg.cloneNode(true) as SVGElement;
    clone.querySelectorAll(".coach-eyes,.animal-eyes").forEach(eyes => eyes.remove());
    return clone.outerHTML;
  });
}
async function expectOpenEyes(avatar: Locator) {
  await expect(avatar).toHaveAttribute("data-face", "settled");
  await eyeState(avatar, "open");
  // Check rendered pupil/display geometry, not just the diagnostic attribute.
  const pupils = await avatar
    .locator(
      "[data-eye-state] .coach-gaze ellipse, [data-eye-state] .study-gaze ellipse, [data-eye-state] .study-gaze rect",
    )
    .evaluateAll(nodes =>
      nodes.map(node => Number(node.getAttribute(node.localName === "rect" ? "height" : "ry"))),
    );
  expect(pupils.length).toBeGreaterThan(0);
  expect(pupils.every(height => height > 0)).toBe(true);
}

// One state per rig: the eye-settle mechanism is shared across emotions.
for (const [coach, state] of [
  ["classic", "good"],
  ["cat-black", "mistake"],
] as const)
  test(`${coach} ${state} reopens attentive eyes without changing the emotion or remounting artwork`, async ({
    page,
  }) => {
    const avatar = await mountFace(page, { coach, state });
    await expect(avatar).toHaveAttribute("data-face", "entrance");
    await eyeState(avatar, "closed");
    await page.clock.runFor(109);
    await eyeState(avatar, "closed");
    await page.clock.runFor(1);
    await expect(avatar).toHaveAttribute("data-phase", "reaction");
    const geometry = await nonEyeGeometry(avatar);
    const take = await avatar.getAttribute("data-take");
    await page.evaluate(() => (window as unknown as HarnessWindow).faceHarness.rememberArtwork());
    await page.clock.runFor(await duration(page));
    await expectOpenEyes(avatar);
    await expect(avatar).toHaveAttribute("data-phase", "rest");
    await expect(avatar).toHaveAttribute("data-expression", state);
    await expect(avatar).toHaveAttribute("data-take", take!);
    expect(await nonEyeGeometry(avatar)).toBe(geometry);
    expect(
      await page.evaluate(() => (window as unknown as HarnessWindow).faceHarness.sameArtwork()),
    ).toBe(true);
  });

// Still and the system reduced-motion setting share this immediate resting face.
test("still renders expressive open resting eyes immediately without delayed motion", async ({
  page,
}) => {
  const avatar = await mountFace(page, { state: "mistake", motion: "still" });
  await expectOpenEyes(avatar);
  await page.evaluate(() => (window as unknown as HarnessWindow).faceHarness.observe());
  await page.clock.runFor(5000);
  await expectOpenEyes(avatar);
  expect(await avatar.evaluate(element => element.getAnimations({ subtree: true }).length)).toBe(0);
  const observations = await page.evaluate(() =>
    (window as unknown as HarnessWindow).faceHarness.observations(),
  );
  expect(
    observations.every(
      sample => sample.face === "settled" && sample.eyes.every(eye => eye === "open"),
    ),
  ).toBe(true);
  await expect(avatar).toHaveAttribute("data-expression", "mistake");
});

test("new reaction keys and manual replay change eye phases once without a dwell flash", async ({
  page,
}) => {
  const avatar = await mountFace(page);
  await page.clock.runFor(110);
  await page.clock.runFor(await duration(page));
  await expectOpenEyes(avatar);
  for (const patch of [{ key: "move:2" }, { replay: 1 }]) {
    await update(page, patch);
    const waitingEyes = patch.key ? "closed" : "open";
    await eyeState(avatar, waitingEyes);
    await page.evaluate(() => (window as unknown as HarnessWindow).faceHarness.observe());
    await page.clock.runFor(109);
    await eyeState(avatar, waitingEyes);
    await page.clock.runFor(1);
    await expect(avatar).toHaveAttribute("data-phase", "reaction");
    await expect(avatar).toHaveAttribute("data-face", "entrance");
    await eyeState(avatar, "closed");
    const observations = await page.evaluate(() =>
      (window as unknown as HarnessWindow).faceHarness.observations(),
    );
    const phases = observations
      .map(sample => `${sample.face}:${sample.eyes.join(",")}`)
      .filter((phase, index, all) => index === 0 || phase !== all[index - 1]);
    expect(phases).toEqual(patch.key ? ["entrance:closed"] : ["settled:open", "entrance:closed"]);
    await page.clock.runFor(await duration(page));
    await expectOpenEyes(avatar);
  }
});

// Hidden and Still share this suspend path; idle-cadence pauses on hidden as well.
test("an interrupted entrance settles when offscreen and resumes without closing or replaying", async ({
  page,
}) => {
  const avatar = await mountFace(page, { state: "winning" });
  await page.clock.runFor(110 + 400);
  await eyeState(avatar, "closed");
  const take = await avatar.getAttribute("data-take");
  await page.locator("#resting-face-harness").evaluate(element => {
    element.style.left = "-1000px";
  });
  await expectOpenEyes(avatar);
  await page.clock.runFor(20_000);
  await page.locator("#resting-face-harness").evaluate(element => {
    element.style.left = "20px";
  });
  await expectOpenEyes(avatar);
  await expect(avatar).toHaveAttribute("data-phase", "rest");
  await expect(avatar).toHaveAttribute("data-take", take!);
  await page.clock.runFor(5000);
  await expectOpenEyes(avatar);
});

test("newer feedback replaces a canceled eye transition and remains expressive", async ({
  page,
}) => {
  const avatar = await mountFace(page, { state: "winning" });
  await page.clock.runFor(110 + 400);
  await update(page, { state: "mistake", key: "move:2" });
  await expect(avatar).toHaveAttribute("data-expression", "mistake");
  await eyeState(avatar, "closed");
  await page.clock.runFor(110);
  await page.clock.runFor(await duration(page));
  await expectOpenEyes(avatar);
  await expect(avatar).toHaveAttribute("data-expression", "mistake");
  await page.clock.runFor(5000);
  await expectOpenEyes(avatar);
});
