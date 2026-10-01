import {expect, test, type Page} from "@playwright/test";
import {castingStore, mockCastingApi} from "./fixtures/castingApi";
import plan from "../src/audio/speech/cast-auditions/design-plan.json" with {type: "json"};
import type {CastingLock} from "../src/audio/studio/useCastingChoices";

const pendingIds = ["dog-puppy", "slime"];
const first = plan.coaches[0];
const panel = (page: Page) => page.getByRole("region", {name: "Cast voice auditions", exact: true});
const coach = (page: Page) => panel(page).getByRole("combobox", {name: "Cast coach", exact: true});
const direction = (page: Page) => panel(page).getByRole("combobox", {name: "Candidate direction", exact: true});
const portrait = (page: Page) => panel(page).locator(".coach-avatar");
const play = (page: Page) => panel(page).getByRole("button", {name: "Play candidate", exact: true});
const speechEvents = (page: Page, type: string) => page.locator(`[data-bus="speech"][data-event-type="${type}"]`);
const collection = (page: Page, name: "Needs a voice" | "Locked voices") =>
  panel(page).getByRole("group", {name: "Casting collection", exact: true}).getByRole("button", {name, exact: true});
const decision = (page: Page) => panel(page).getByRole("region", {name: /^Your choice for /});

function lockedStore(pending: readonly string[] = pendingIds) {
  const store = castingStore();
  const locks: Record<string, CastingLock> = Object.fromEntries(plan.coaches.filter(item => !pending.includes(item.coachId)).map(item => {
    const chosen = item.directions[1];
    return [item.coachId, {coachId: item.coachId, directionId: chosen.id, label: chosen.label,
      recording: store.candidates[item.coachId][chosen.id], savedVoiceId: `saved:${item.coachId}`,
      voiceName: `${item.name} approved voice`, lockedAt: "2026-10-01T12:00:00Z", stale: false}];
  }));
  for (const coachId of pending) store.choices[coachId] = {coachId, status: "keep-looking",
    note: "Try a different direction.", revision: `pending:${coachId}`, updatedAt: "2026-10-01T12:00:00Z", stale: false};
  return Object.assign(store, {locks});
}

async function observeNextDecode(page: Page) {
  await page.evaluate(() => {
    let finished!: (error?: string) => void;
    Object.assign(window, {castingDecoded: new Promise<string | undefined>(resolve => {finished = resolve;})});
    const decode = BaseAudioContext.prototype.decodeAudioData;
    BaseAudioContext.prototype.decodeAudioData = function (bytes, success, failure) {
      const result = decode.call(this, bytes, success, failure);
      void result.then(() => finished(), error => finished(String(error)));
      return result;
    };
  });
}

async function waitForDecode(page: Page) {
  const error = await page.evaluate(async () => {
    const result = await (window as unknown as {castingDecoded: Promise<string | undefined>}).castingDecoded;
    await Promise.resolve();
    await Promise.resolve();
    return result;
  });
  expect(error).toBeUndefined();
}

test("eighteen locks leave puppy and slime as the silent pending-first audition list", async ({page}, info) => {
  const store = await mockCastingApi(page, lockedStore());
  const recordings: string[] = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith(".mp3") && !url.searchParams.has("import")) recordings.push(request.url());
  });
  await page.goto("/");
  if (info.project.name === "mobile") await page.setViewportSize({width: 320, height: 780});
  await expect(panel(page)).toContainText("18 locked · 2 need a voice");
  await expect(collection(page, "Needs a voice")).toHaveAttribute("aria-pressed", "true");
  expect(await coach(page).locator("option").evaluateAll(options => options.map(option => (option as HTMLOptionElement).value).sort()))
    .toEqual([...pendingIds].sort());
  await expect(coach(page)).toHaveValue("dog-puppy");
  await expect(portrait(page)).toHaveAttribute("data-coach", "dog-puppy");
  await expect(decision(page)).toContainText("Keep looking — none of these fit");
  await expect(play(page)).toBeEnabled();
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  await expect(speechEvents(page, "started")).toHaveCount(0);
  expect(recordings).toEqual([]);
  expect(store.writes).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel(page).screenshot({path: info.outputPath("casting-locks-pending.png")});
});

test("a locked direction overrides an old choice and remains inspectable without editing or voting", async ({page}, info) => {
  const store = lockedStore();
  const older = first.directions[2];
  store.choices[first.coachId] = {coachId: first.coachId, status: "selected", directionId: older.id,
    note: "An earlier choice must not override the lock.", revision: "old", updatedAt: "2026-10-01T11:00:00Z",
    stale: false, recording: store.candidates[first.coachId][older.id]};
  await mockCastingApi(page, store);
  await page.goto("/");
  await expect(panel(page)).toContainText("18 locked · 2 need a voice");
  await collection(page, "Locked voices").click();
  await expect(coach(page).locator("option")).toHaveCount(18);
  await coach(page).selectOption(first.coachId);
  const locked = store.locks[first.coachId];
  await expect(direction(page)).toHaveValue(locked.directionId);
  await expect(decision(page)).toContainText(`Locked: ${locked.label}`);
  await expect(decision(page)).toContainText("Its dialogue bank has not been recorded yet.");
  await expect(decision(page).locator("button, textarea, input")).toHaveCount(0);
  await panel(page).screenshot({path: info.outputPath("casting-locks-readonly.png")});
  await direction(page).selectOption(first.directions[0].id);
  await expect(decision(page)).toContainText(`Locked: ${locked.label}`);
  await expect(play(page)).toBeEnabled();
  await play(page).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await expect(speechEvents(page, "started")).toHaveCount(1);
  expect(store.writes).toEqual([]);
  await page.reload();
  await expect(panel(page)).toContainText("18 locked · 2 need a voice");
  await collection(page, "Locked voices").click();
  await coach(page).selectOption(first.coachId);
  await expect(direction(page)).toHaveValue(locked.directionId);
  await expect(decision(page).locator("button, textarea, input")).toHaveCount(0);
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  expect(store.writes).toEqual([]);
});

test("an empty pending collection retains navigation to inspect all locked voices", async ({page}) => {
  const store = await mockCastingApi(page, lockedStore([]));
  await page.goto("/");
  await expect(panel(page)).toContainText("20 locked · 0 need a voice");
  await expect(panel(page)).toContainText("Every coach has a locked voice. You can inspect them under Locked voices.");
  await expect(collection(page, "Needs a voice")).toHaveAttribute("aria-pressed", "true");
  await expect(coach(page)).toHaveCount(0);
  await expect(play(page)).toHaveCount(0);
  await collection(page, "Locked voices").click();
  await expect(coach(page).locator("option")).toHaveCount(20);
  await expect(portrait(page)).toHaveAttribute("data-coach", first.coachId);
  await expect(play(page)).toBeEnabled();
  await collection(page, "Needs a voice").click();
  await expect(coach(page)).toHaveCount(0);
  await expect(collection(page, "Locked voices")).toBeEnabled();
  expect(store.writes).toEqual([]);
  await expect(speechEvents(page, "started")).toHaveCount(0);
});

test("a stale locked recording is surfaced for inspection while its saved voice remains read-only", async ({page}) => {
  const store = lockedStore();
  store.locks[first.coachId] = {...store.locks[first.coachId], stale: true,
    staleReason: "The audition bytes changed after this voice was locked."};
  await mockCastingApi(page, store);
  await page.goto("/");
  await expect(panel(page)).toContainText("18 locked · 2 need a voice · 1 need review");
  await expect(panel(page)).toContainText("A locked audition has changed or is unavailable. The saved voice remains locked.");
  await expect(coach(page)).toHaveValue("dog-puppy");
  await panel(page).getByRole("button", {name: "Inspect locked recording", exact: true}).click();
  await expect(collection(page, "Locked voices")).toHaveAttribute("aria-pressed", "true");
  await expect(coach(page)).toHaveValue(first.coachId);
  await expect(decision(page)).toContainText(`Locked: ${store.locks[first.coachId].label}`);
  await expect(decision(page).getByRole("alert")).toHaveText("The audition bytes changed after this voice was locked.");
  await expect(decision(page).locator("button, textarea, input")).toHaveCount(0);
  await expect(speechEvents(page, "started")).toHaveCount(0);
  expect(store.writes).toEqual([]);
});

test("late locks preserve the coach, candidate and audio explicitly started before the host responded", async ({page}) => {
  const store = await mockCastingApi(page, lockedStore());
  let release!: () => void;
  const held = new Promise<void>(resolve => {release = resolve;});
  await page.route("**/__fieldwork/casting", async route => {await held; await route.fallback();});
  try {
    await page.goto("/");
    await expect(coach(page)).toHaveValue(first.coachId);
    await expect(direction(page)).toHaveValue(first.directions[0].id);
    await play(page).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    release();
    await expect(decision(page)).toContainText(`Locked: ${store.locks[first.coachId].label}`);
    await expect(collection(page, "Locked voices")).toHaveAttribute("aria-pressed", "true");
    await expect(coach(page)).toHaveValue(first.coachId);
    await expect(direction(page)).toHaveValue(first.directions[0].id);
    await expect(portrait(page)).toHaveAttribute("data-coach", first.coachId);
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    await expect(speechEvents(page, "started")).toHaveCount(1);
    await expect(speechEvents(page, "cancelled")).toHaveCount(0);
    expect(store.writes).toEqual([]);
  } finally {release(); await page.unrouteAll({behavior: "wait"});}
});

for (const state of ["playing", "loading"] as const) {
  test(`switching from locked to pending cancels ${state} audio without a stale restart`, async ({page}) => {
    const store = await mockCastingApi(page, lockedStore());
    let release!: () => void;
    const held = new Promise<void>(resolve => {release = resolve;});
    let requested!: () => void;
    const requesting = new Promise<void>(resolve => {requested = resolve;});
    if (state === "loading") await page.route(url => url.pathname.endsWith(".mp3") && !url.searchParams.has("import"), async route => {
      requested(); await held; await route.continue();
    }, {times: 1});
    try {
      await page.goto("/");
      await expect(panel(page)).toContainText("18 locked · 2 need a voice");
      await collection(page, "Locked voices").click();
      await coach(page).selectOption(first.coachId);
      await expect(play(page)).toBeEnabled();
      if (state === "loading") await observeNextDecode(page);
      await play(page).click();
      if (state === "loading") await requesting;
      await expect(panel(page)).toHaveAttribute("data-playback", state);
      await collection(page, "Needs a voice").click();
      await expect(coach(page)).toHaveValue("dog-puppy");
      await expect(portrait(page)).toHaveAttribute("data-coach", "dog-puppy");
      await expect(panel(page)).toHaveAttribute("data-playback", "idle");
      await expect(portrait(page)).toHaveAttribute("data-speaking", "false");
      await expect(speechEvents(page, "cancelled")).toHaveCount(1);
      if (state === "loading") {release(); await waitForDecode(page);}
      await expect(speechEvents(page, "started")).toHaveCount(state === "playing" ? 1 : 0);
      await expect(panel(page)).toHaveAttribute("data-playback", "idle");
      expect(store.writes).toEqual([]);
    } finally {release(); await page.unrouteAll({behavior: "wait"});}
  });
}
