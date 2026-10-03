import {expect, test, type Page} from "@playwright/test";
import path from "node:path";
import {viteFsPath} from "../studio-tests/helpers/viteFsPath";
import type {CoachDefinition} from "../src/coach/model";

const animals = ["gorilla", "raccoon", "frog", "capybara"];
const shapes = ["rest", "closed", "consonant", "open", "wide", "round", "pucker", "lip-bite", "tongue"];

async function sheet(page: Page, expressions = ["neutral"], sizes = [92.8, 52.5], poses = shapes) {
  await page.goto("/");
  await page.evaluate(async ({root, animals, expressions, sizes, poses}) => {
    const {React, createRoot} = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const {CoachCharacter} = await import(`${root}/src/coach/CoachAvatar.tsx`);
    const {getCoach} = await import(`${root}/src/coach/registry.ts`);
    const container = document.createElement("section");
    container.id = "other-animal-mouths";
    container.style.cssText = `position:absolute;inset:0 auto auto 0;z-index:9999;background:#151718;color:#eee;padding:16px;display:grid;grid-template-columns:repeat(${poses.length},116px);gap:8px;font:12px sans-serif`;
    document.body.append(container);
    createRoot(container).render(React.createElement(React.Fragment, null,
      ...sizes.flatMap(size => animals.flatMap(coach => expressions.flatMap(expression => poses.map(shape =>
        React.createElement("figure", {key: `${coach}-${expression}-${shape}-${size}`,
          "data-coach": coach, "data-expression": expression, "data-shape": shape, "data-size": size,
          style: {margin: 0, display: "grid", justifyItems: "center", gap: 4}},
        React.createElement(CoachCharacter, {coach: getCoach(coach), reaction: {state: expression, key: expression},
          motion: "still", idle: false}),
        React.createElement("figcaption", null, `${coach} · ${shape} · ${size}`),
      ))))),
    ));
  }, {root: viteFsPath(path.resolve(".")), animals, expressions, sizes, poses});
  const portraits = page.locator("#other-animal-mouths .coach-avatar");
  await expect(portraits).toHaveCount(animals.length * expressions.length * sizes.length * poses.length);
  await portraits.evaluateAll(nodes => {
    for (const node of nodes) {
      const avatar = node as HTMLElement, size = Number(avatar.parentElement!.dataset.size);
      avatar.style.width = `${size}px`;
      avatar.style.height = `${size * 1.25}px`;
    }
  });
  return page.locator("#other-animal-mouths");
}

test("other animals articulate every shape at ordinary and small portrait sizes", async ({page}, info) => {
  const portraits = await sheet(page);
  const geometry = await portraits.evaluate(async (container, root) => {
    const {speechMouthPoses} = await import(`${root}/src/coach/speechMouth.ts`);
    return [...container.querySelectorAll<HTMLElement>("figure")].map(figure => {
      const avatar = figure.querySelector<HTMLElement>(".coach-avatar")!;
      avatar.dataset.speaking = "true";
      avatar.dataset.speechPreview = "true";
      for (const [control, value] of Object.entries(speechMouthPoses[figure.dataset.shape!]))
        avatar.style.setProperty(`--speech-${control}`, String(value));
      const aperture = avatar.querySelector<SVGPathElement>(".organic-speech-opening > .organic-speech-aperture")!;
      const bounds = aperture.getBoundingClientRect();
      return {coach: figure.dataset.coach, size: figure.dataset.size, shape: figure.dataset.shape,
        width: bounds.width, height: bounds.height, contour: getComputedStyle(aperture).d};
    });
  }, viteFsPath(path.resolve(".")));
  await portraits.screenshot({path: info.outputPath("other-animal-mouth-targets.png"), animations: "allow"});
  for (const coach of animals) for (const size of ["92.8", "52.5"]) {
    const samples = Object.fromEntries(geometry.filter(row => row.coach === coach && row.size === size).map(row => [row.shape!, row]));
    expect(samples.wide.width).toBeGreaterThan(samples.round.width * 1.4);
    expect(samples.round.width / samples.round.height).toBeGreaterThan(.7);
    expect(samples.round.width / samples.round.height).toBeLessThan(1.5);
    expect(samples.pucker.width).toBeLessThan(samples.round.width * .85);
    expect(samples.pucker.height).toBeLessThan(samples.round.height);
    expect(samples.round.contour).not.toBe(samples.wide.contour);
    expect(Object.values(samples).every(row => Number.isFinite(row.width) && Number.isFinite(row.height))).toBe(true);
    if (coach === "frog") expect(samples.wide.width / samples.wide.height).toBeGreaterThan(3.5);
  }
  for (const coach of ["gorilla", "raccoon", "frog"]) {
    await expect(portraits.locator(`figure[data-coach="${coach}"] .organic-speech-teeth`)).toHaveCount(0);
  }
  await expect(portraits.locator('figure[data-coach="frog"] .organic-speech-tongue-tip')).toHaveCount(0);
  // Fergus speaks from his resting lip line, with enough height that rounded sounds read as a mouth.
  await expect(portraits.locator('figure[data-coach="frog"] .organic-speech-mouth').first())
    .toHaveAttribute("transform", "translate(50 61) scale(1.9 1.2)");
  const frogRound = geometry.find(row => row.coach === "frog" && row.size === "92.8" && row.shape === "round")!;
  expect(frogRound.height).toBeGreaterThan(6);
  const capybara = portraits.locator('figure[data-coach="capybara"]').first();
  await expect(capybara.locator(".organic-speech-mouth")).toHaveAttribute("transform", "translate(56 64) scale(1.25 0.8)");
  expect(await capybara.locator(".organic-speech-mouth").evaluate(node => node.closest('.study-muzzle')!.parentElement!.getAttribute("transform")))
    .toBe("translate(5 0)");
  await expect(capybara.locator(".capybara-speech-incisors path")).toHaveCount(2);
  const masks = await portraits.locator(".organic-speech-mouth clipPath").evaluateAll(nodes => nodes.map(node => node.id));
  expect(new Set(masks).size).toBe(masks.length);
});

test("speech preserves animal expressions, nose stems, throat and existing rig layers", async ({page}) => {
  const portraits = await sheet(page, ["neutral", "brilliant", "mistake", "blunder"], [92.8], ["authored"]);
  const original = await portraits.locator(".speech-mouth-authored").evaluateAll(nodes => nodes.map(node => node.innerHTML));
  const throat = portraits.locator('.cast-frog-throat').first();
  const originalThroat = await throat.evaluate(node => ({path: node.getAttribute("d"), transform: getComputedStyle(node).transform}));
  await portraits.locator(".coach-avatar").evaluateAll(nodes => {
    for (const node of nodes) {
      const avatar = node as HTMLElement;
      avatar.dataset.speaking = "true";
      avatar.style.setProperty("--speech-open", ".9");
    }
  });
  // Still retains authored art even if a stale playback flag was left behind.
  for (const mouth of await portraits.locator(".speech-mouth-authored").all()) await expect(mouth).toBeVisible();
  await portraits.locator(".coach-avatar").evaluateAll(nodes => nodes.forEach(node => (node as HTMLElement).dataset.speechPreview = "true"));
  for (const mouth of await portraits.locator(".speech-mouth-authored").all()) await expect(mouth).toBeHidden();
  for (const mouth of await portraits.locator(".speech-mouth-live").all()) await expect(mouth).toBeVisible();
  const connections = await portraits.evaluate(container => [
    ...container.querySelectorAll('.cast-raccoon path[d="M50 57v5"], .cast-capybara path[d="M56 59v5"]'),
    ...container.querySelectorAll(".cast-frog-throat"),
  ].map(node => ({inSpeechLayer: !!node.closest(".speech-mouth-layer"), hidden: getComputedStyle(node).display === "none"})));
  expect(connections).toHaveLength(12);
  expect(connections.every(node => !node.inSpeechLayer && !node.hidden)).toBe(true);
  expect(await throat.evaluate(node => ({path: node.getAttribute("d"), transform: getComputedStyle(node).transform}))).toEqual(originalThroat);
  expect(await portraits.locator(".speech-mouth-layer").evaluateAll(nodes => nodes.every(node =>
    !!node.closest(".study-muzzle") && !!node.closest(".study-head-pose") && !!node.closest(".study-head-idle") && !!node.closest(".study-head"))))
    .toBe(true);
  const incisors = portraits.locator(".capybara-speech-incisors").first();
  expect(Number(await incisors.evaluate(node => getComputedStyle(node).opacity))).toBeGreaterThan(0);
  await portraits.locator(".coach-avatar").evaluateAll(nodes => nodes.forEach(node => {
    const avatar = node as HTMLElement;
    avatar.dataset.speaking = "false";
    delete avatar.dataset.speechPreview;
  }));
  for (const mouth of await portraits.locator(".speech-mouth-authored").all()) await expect(mouth).toBeVisible();
  for (const mouth of await portraits.locator(".speech-mouth-live").all()) await expect(mouth).toBeHidden();
  expect(await portraits.locator(".speech-mouth-authored").evaluateAll(nodes => nodes.map(node => node.innerHTML))).toEqual(original);
});

test("all four animal mouths follow the shared playback clock without replacing the head artwork", async ({page}) => {
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto("/");
  await page.evaluate(async ({root, animals}) => {
    const {React, createRoot} = await import(`${root}/studio-tests/fixtures/runtime.ts`);
    const {CoachCharacter} = await import(`${root}/src/coach/CoachAvatar.tsx`);
    const {getCoach} = await import(`${root}/src/coach/registry.ts`);
    let active = true, elapsed = .4;
    const container = document.createElement("section");
    container.id = "other-animal-playback";
    container.style.cssText = "position:fixed;inset:12px auto auto 12px;z-index:9999;display:grid;grid-template-columns:repeat(2,104px);gap:8px;background:#151718";
    document.body.append(container);
    createRoot(container).render(React.createElement(React.Fragment, null, ...animals.map(id => {
      const coach: CoachDefinition = getCoach(id);
      return React.createElement("div", {key: id, style: {width: 104, height: 130}}, React.createElement(CoachCharacter, {
        coach: {...coach, families: coach.families.map(family => ({...family, speech: true})), capabilities: {...coach.capabilities, speech: true}},
        reaction: {state: "neutral", key: id}, motion: "natural", idle: false,
        speech: {scope: "animal-artwork-test", eventId: id, utteranceId: id, coachId: id,
          read: () => active ? {elapsedSeconds: elapsed, energy: .8, brightness: .4} : null},
        speechTrack: {durationSeconds: 2, cues: [{start: 0, end: 1, shape: "wide"}, {start: 1, end: 2, shape: "pucker"}]},
      }));
    })));
    Object.assign(window, {animalSpeechFixture: {pucker: () => {elapsed = 1.4;}, stop: () => {active = false;}}});
  }, {root: viteFsPath(path.resolve(".")), animals});
  const portraits = page.locator("#other-animal-playback .coach-avatar");
  await expect(portraits).toHaveCount(4);
  await page.clock.runFor(200);
  for (const portrait of await portraits.all()) await expect(portrait).toHaveAttribute("data-speaking", "true");
  const artwork = await portraits.locator("svg.coach-artwork").elementHandles();
  const wide = await portraits.locator(".organic-speech-opening > .organic-speech-aperture").evaluateAll(nodes => nodes
    .filter(node => getComputedStyle(node).fill !== "none").map(node => node.getBoundingClientRect().width));
  await page.evaluate(() => (window as unknown as {animalSpeechFixture: {pucker: () => void}}).animalSpeechFixture.pucker());
  await page.clock.runFor(300);
  const puckered = await portraits.locator(".organic-speech-opening > .organic-speech-aperture").evaluateAll(nodes => nodes
    .filter(node => getComputedStyle(node).fill !== "none").map(node => node.getBoundingClientRect().width));
  expect(puckered.every((width, index) => width < wide[index] * .7)).toBe(true);
  expect(await Promise.all(artwork.map(node => node.evaluate(element => element.isConnected)))).toEqual([true, true, true, true]);
  await page.evaluate(() => (window as unknown as {animalSpeechFixture: {stop: () => void}}).animalSpeechFixture.stop());
  // A finished line eases closed before the authored mouth returns.
  await page.clock.runFor(80);
  for (const portrait of await portraits.all()) await expect(portrait).toHaveAttribute("data-speaking", "true");
  await page.clock.runFor(200);
  for (const portrait of await portraits.all()) {
    await expect(portrait).toHaveAttribute("data-speaking", "false");
    await expect(portrait.locator(".speech-mouth-authored")).toBeVisible();
    await expect(portrait.locator(".speech-mouth-live")).toBeHidden();
  }
});
