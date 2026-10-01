import {expect, test, type Page} from "@playwright/test";
import {castingStore, mockCastingApi} from "./fixtures/castingApi";
import plan from "../src/audio/speech/cast-auditions/design-plan.json" with {type: "json"};

const first = plan.coaches[0], second = plan.coaches[1];
const panel = (page: Page) => page.getByRole("region", {name: "Cast voice auditions", exact: true});
const decision = (page: Page) => panel(page).getByRole("region", {name: /^Your choice for /});
const direction = (page: Page) => panel(page).getByRole("combobox", {name: "Candidate direction", exact: true});
const coach = (page: Page) => panel(page).getByRole("combobox", {name: "Cast coach", exact: true});
const choose = (page: Page) => decision(page).getByRole("button", {name: "Choose this voice", exact: true});
const note = (page: Page) => decision(page).getByRole("textbox", {name: "Note (optional)", exact: true});

test("listening does not vote; an explicit choice saves exact identity, notes and progress without restarting audio", async ({page}, info) => {
  const store = await mockCastingApi(page);
  await page.goto("/");
  if (info.project.name === "mobile") await page.setViewportSize({width: 320, height: 780});
  await expect(choose(page)).toBeEnabled();
  await expect(panel(page)).toContainText("0 chosen · 0 keep looking · 20 to decide");
  await direction(page).selectOption(first.directions[1].id);
  const mediaRequest = page.waitForRequest(request => new URL(request.url()).pathname.endsWith(".mp3"));
  await panel(page).getByRole("button", {name: "Play candidate", exact: true}).click();
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  expect(new URL((await mediaRequest).url()).searchParams.get("casting"))
    .toBe(store.candidates[first.coachId][first.directions[1].id].audioSha256);
  expect(store.writes).toEqual([]);
  await note(page).fill("This warmth fits. Keep the teaching pace.");
  await choose(page).click();
  await expect(decision(page)).toContainText(`Chosen: ${first.directions[1].label}`);
  await expect(decision(page).getByRole("button", {name: "Voice chosen", exact: true})).toBeDisabled();
  expect(store.writes[0]).toEqual({method: "PUT", coachId: first.coachId, body: {
    status: "selected", directionId: first.directions[1].id, note: "This warmth fits. Keep the teaching pace.",
    expectedRevision: null, expectedRecordingFingerprint: store.candidates[first.coachId][first.directions[1].id].fingerprint,
  }});
  await expect(page.locator('[data-bus="speech"][data-event-type="started"]')).toHaveCount(1);
  await expect(panel(page)).toHaveAttribute("data-playback", "playing");
  await expect(panel(page)).toContainText("1 chosen · 0 keep looking · 19 to decide");
  await direction(page).selectOption(first.directions[2].id);
  await expect(decision(page)).toContainText(`Chosen: ${first.directions[1].label}`);
  expect(store.writes).toHaveLength(1);
  await page.reload();
  await expect(direction(page)).toHaveValue(first.directions[1].id);
  await expect(note(page)).toHaveValue("This warmth fits. Keep the teaching pace.");
  await expect(panel(page)).toHaveAttribute("data-playback", "idle");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel(page).screenshot({path: info.outputPath("casting-choice-saved.png")});
});

test("keep-looking, notes, revision and reset remain isolated per coach and restore on another device", async ({page, browser}) => {
  const store = await mockCastingApi(page);
  await page.goto("/");
  await expect(choose(page)).toBeEnabled();
  await note(page).fill("None fit yet; less gravel next time.");
  await decision(page).getByRole("button", {name: "Keep looking", exact: true}).click();
  await expect(decision(page)).toContainText("Keep looking — none of these fit");
  expect(store.choices[first.coachId].status).toBe("keep-looking");
  await coach(page).selectOption(second.coachId);
  await expect(note(page)).toHaveValue("");
  await choose(page).click();
  await expect(panel(page)).toContainText("1 chosen · 1 keep looking · 18 to decide");
  const other = await browser.newContext();
  try {
    const device = await other.newPage();
    await mockCastingApi(device, store);
    await device.goto(page.url());
    await expect(decision(device)).toContainText("Keep looking — none of these fit");
    await expect(note(device)).toHaveValue("None fit yet; less gravel next time.");
    await direction(device).selectOption(first.directions[2].id);
    await choose(device).click();
    await expect(decision(device)).toContainText(`Chosen: ${first.directions[2].label}`);
    await expect(panel(device)).toContainText("2 chosen · 0 keep looking · 18 to decide");
    await decision(device).getByRole("button", {name: "Clear choice", exact: true}).click();
    await expect(decision(device)).toContainText("Not decided yet");
    expect(store.choices[first.coachId]).toBeUndefined();
    expect(store.choices[second.coachId].status).toBe("selected");
    expect(store.writes.at(-1)?.body.expectedRevision).toMatch(/^revision:/);
  } finally { await other.close(); }
});

test("a changed recording or conflicting device choice cannot be approved silently", async ({page}) => {
  const store = await mockCastingApi(page);
  await page.goto("/");
  await expect(choose(page)).toBeEnabled();
  const identity = store.candidates[first.coachId][first.directions[0].id];
  identity.fingerprint = "replaced-recording-fingerprint";
  identity.audioSha256 = "replaced-audio-sha";
  await note(page).fill("Do not lose my note on failure.");
  await choose(page).click();
  await expect(decision(page).getByRole("alert")).toContainText("This choice changed on another device");
  expect(store.choices[first.coachId]).toBeUndefined();
  await expect(decision(page)).toContainText("Not decided yet");
  await expect(note(page)).toHaveValue("Do not lose my note on failure.");
  await decision(page).getByRole("button", {name: "Reload saved choices", exact: true}).click();
  await expect(panel(page)).toContainText("This preview differs from the studio’s current recording");
  await expect(choose(page)).toBeDisabled();
  await expect(note(page)).toHaveValue("Do not lose my note on failure.");
});

test("a late host response cannot relabel an audition already started by the listener", async ({page}) => {
  const store = castingStore();
  const chosen = first.directions[1];
  store.choices[first.coachId] = {coachId: first.coachId, status: "selected", directionId: chosen.id, note: "Saved earlier",
    revision: "prior", updatedAt: "2026-10-01T12:00:00Z", stale: false, recording: store.candidates[first.coachId][chosen.id]};
  await mockCastingApi(page, store);
  let release!: () => void;
  const held = new Promise<void>(resolve => {release = resolve;});
  await page.route("**/__fieldwork/casting", async route => {await held; await route.fallback();});
  try {
    await page.goto("/");
    await expect(direction(page)).toHaveValue(first.directions[0].id);
    await panel(page).getByRole("button", {name: "Play candidate", exact: true}).click();
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    release();
    await expect(decision(page)).toContainText(`Chosen: ${chosen.label}`);
    await expect(direction(page)).toHaveValue(first.directions[0].id);
    await expect(panel(page)).toHaveAttribute("data-playback", "playing");
    await expect(page.locator('[data-bus="speech"][data-event-type="started"]')).toHaveCount(1);
  } finally { release(); await page.unrouteAll({behavior: "wait"}); }
});

test("a pending save reports its own coach after navigation and never overwrites another coach's draft", async ({page}) => {
  const store = await mockCastingApi(page);
  let release!: () => void;
  const held = new Promise<void>(resolve => {release = resolve;});
  await page.route(`**/__fieldwork/casting/${first.coachId}`, async route => {await held; await route.fallback();}, {times: 1});
  try {
    await page.goto("/");
    await expect(choose(page)).toBeEnabled();
    await note(page).fill("First coach only");
    await choose(page).click();
    await expect(decision(page)).toContainText("Saving to the studio");
    await coach(page).selectOption(second.coachId);
    await expect(note(page)).toHaveValue("");
    release();
    await expect(choose(page)).toBeEnabled();
    await expect(decision(page)).toContainText("Not decided yet");
    await expect(note(page)).toHaveValue("");
    await expect(panel(page)).toContainText("1 chosen · 0 keep looking · 19 to decide");
    expect(store.choices[first.coachId].note).toBe("First coach only");
    expect(store.choices[second.coachId]).toBeUndefined();
  } finally { release(); await page.unrouteAll({behavior: "wait"}); }
});

test("stale saved choices require an explicit fresh approval and do not count as finished", async ({page}) => {
  const store = castingStore();
  store.choices[first.coachId] = {coachId: first.coachId, status: "selected", directionId: first.directions[0].id,
    note: "Earlier recording", updatedAt: "2026-10-01T11:00:00Z", revision: "old-revision", stale: true,
    staleReason: "Recording changed", recording: {...store.candidates[first.coachId][first.directions[0].id], audioSha256: "old"}};
  await mockCastingApi(page, store);
  await page.goto("/");
  await expect(decision(page)).toContainText("Recording changed — review this choice");
  await expect(panel(page)).toContainText("0 chosen · 0 keep looking · 20 to decide");
  await expect(choose(page)).toBeEnabled();
  expect(store.writes).toEqual([]);
  await choose(page).click();
  await expect(decision(page)).toContainText(`Chosen: ${first.directions[0].label}`);
  expect(store.choices[first.coachId].stale).toBe(false);
  expect(store.choices[first.coachId].recording?.audioSha256).toBe(store.candidates[first.coachId][first.directions[0].id].audioSha256);
});

test("unavailable studio persistence is actionable, keeps playback usable, and supports retry", async ({page}) => {
  await mockCastingApi(page);
  let available = false;
  await page.route("**/__fieldwork/casting", route => available ? route.fallback() :
    route.fulfill({status: 404, contentType: "text/html", body: "<!doctype html><title>Not found</title>"}));
  await page.goto("/");
  await expect(panel(page).getByRole("alert")).toContainText("Run or restart the local studio");
  await expect(choose(page)).toBeDisabled();
  await expect(panel(page).getByRole("button", {name: "Play candidate", exact: true})).toBeEnabled();
  available = true;
  await panel(page).getByRole("button", {name: "Retry loading choices", exact: true}).click();
  await expect(choose(page)).toBeEnabled();
  await expect(panel(page).getByRole("alert")).toHaveCount(0);
});
